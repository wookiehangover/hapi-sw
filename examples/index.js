const Hapi = require('hapi')
const server = new Hapi.Server()
const path = require('path')

console.log(__dirname)

server.connection({ port: 9000 })

server.register([
  require('inert'),
  {
    register: require('../'),
    options: {
      verbose: true,
      staticFileGlobs: [
        '*.css'
      ],
      runtimeCaching: [
            {
              urlPattern: /https:\/\/unsplash.it\//,
              handler: 'fastest',
              options: {
                debug: true
              }
            },
            {
                urlPattern: /https:\/\/unpkg.com\//,
                handler: 'cacheFirst',
                options: {
                  debug: true
                }
            }
        ]
    }
  }
], (err) => {
  if (err) {
    throw err
  }

  server.route([
    {
      path: '/',
      method: 'GET',
      config: {
        plugins: {
          sw: {
            dynamicUrlToDependencies: [
              'index.html',
            ]
          }
        }
      },
      handler: {
        file: 'index.html'
      }
    },
    {
      path: '/{param*}',
      method: 'GET',
      handler: {
          directory: {
              path: path.resolve(__dirname)
          }
      }
    }
  ])

  server.start((err) => {
    console.log(`Server started on ${server.info.uri}`)
  })
})
