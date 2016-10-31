'use strict'

const Hapi = require('hapi')
const sw = require('./')
const assert = require('chai').assert

describe('hapi-sw', function() {
  it('is a well-formed Hapi plugin', function(done) {
    const server = new Hapi.Server()
    server.connection({ port: 9001 })
    server.register(sw, function(err) {
      assert.isUndefined(err)
      done()
    })
  })
})
