'use strict'

const pkg = require('./package.json')
const swPrecache = require('sw-precache')
const Hoek = require('hoek')
const Joi = require('joi')
const fs = require('fs')
const path = require('path')
const internals = {}

internals.routeOptionSchema = {
  dynamicUrlToDependencies: Joi.array().optional(),
  dontCacheBustUrlsMatching: [ Joi.string().optional(), Joi.boolean().optional() ],
  navigateFallback: Joi.boolean().optional(),
  runtimeCaching: Joi.object().keys({
    handler: Joi.string().allow(['networkFirst', 'cacheFirst', 'fastest', 'cacheOnly', 'networkOnly']),
    method: Joi.string().allow(['get', 'post', 'put', 'delete', 'head']).insensitive().optional().lowercase(),
    options: Joi.object().optional()
  }).optional()
}

internals.globalOptionsSchema = {
  cacheId: Joi.string().optional(),
  clientsClaim: Joi.boolean().optional(),
  directoryIndex: Joi.string().optional(),
  dontCacheBustUrlsMatching: Joi.string().regex(/^\/.*\//).raw().optional(),
  dynamicUrlToDependencies: Joi.object().optional(),
  handleFetch: Joi.boolean().optional(),
  ignoreUrlParametersMatching: Joi.array().optional(),
  importScripts: Joi.array().items(Joi.string()).optional(),
  logger: Joi.func().optional(),
  maximumFileSizeToCacheInBytes: Joi.number().optional(),
  navigateFallback: Joi.string().optional(),
  navigateFallbackWhitelist: Joi.array().optional(),
  replacePrefix: Joi.string().optional(),
  runtimeCaching: Joi.array().items(Joi.object().keys({
    urlPattern: Joi.any().required(),
    handler: Joi.string().allow(['networkFirst', 'cacheFirst', 'fastest', 'cacheOnly', 'networkOnly']),
    method: Joi.string().allow(['get', 'post', 'put', 'delete', 'head']).insensitive().optional().lowercase(),
    options: Joi.object().optional()
  })).optional(),
  skipWaiting: Joi.boolean().optional(),
  staticFileGlobs: Joi.array().items(Joi.string()).optional(),
  stripPrefix: Joi.string().optional(),
  stripPrefixMulti: Joi.object().optional(),
  templateFilePath: Joi.string().optional(),
  verbose: Joi.boolean().optional(),
  // custom options below
  defaultWorker: Joi.string().optional()
}

internals.mergeOptions = function (key, value, route) {
  let result = {}
  switch (key) {
    case 'dynamicUrlToDependencies':
      result[key] = {}
      result[key][route.path] = value
      break
    case 'dontCacheBustUrlsMatching':
      if (value === true) {
        result[key] = [ new RegExp(route.path) ]
      } else {
        result[key] = value
      }
      break
    default:
      result = false
      break
  }
  return result
}

internals.reduceRouteConfig = function (settings, route) {
  return Object.keys(settings)
      .map(key => internals.mergeOptions(key, settings[key], route))
      .filter(param => Boolean(param))
      .reduce((result, value, key) => {
        return Object.assign(result, value)
      }, {})
}

const registrationPath = path.resolve(`${__dirname}/service-worker-registration.js`)

function ServiceWorkerPlugin (server, options, callback) {
  Joi.validate(options, internals.globalOptionsSchema, (err, config) => {
    if (err) {
      return callback(err)
    }

    let needsRegeneration = true
    let worker = config.defaultWorker || ''

    function registerRoutes (route) {
      Joi.validate(route.settings.plugins.sw, internals.routeOptionSchema, (err, settings) => {
        if (err) {
          callback(err)
        } else if (settings) {
          const routeConfig = internals.reduceRouteConfig(settings, route)

          if (routeConfig) {
            Hoek.merge(config, routeConfig)
            needsRegeneration = true
          }
        }
      })
    }

    function generateSw (request, reply) {
      if (needsRegeneration === false) {
        reply(worker)
        return
      }

      swPrecache.generate(config, (err, newWorker) => {
        if (!err) needsRegeneration = false
        worker = newWorker
        reply(err, worker)
      })
    }

    server.route([{
      path: '/service-worker.js',
      method: 'GET',
      config: {
        auth: false,
        pre: [{
          assign: 'sw',
          failAction: 'log',
          method: generateSw
        }]
      },
      handler (request, reply) {
        reply(request.pre.sw).type('application/javascript')
      }
    },
    {
      path: '/service-worker-registration.js',
      method: 'GET',
      config: {
        auth: false
      },
      handler (request, reply) {
        reply(fs.createReadStream(require.resolve('./service-worker-registration.js'), 'utf8'))
      }
    }])

    server.on('route', registerRoutes)

    callback()
  })
}

ServiceWorkerPlugin.attributes = {
  name: 'sw',
  version: pkg.version
}

module.exports = ServiceWorkerPlugin
