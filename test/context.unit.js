'use strict'

const Code = require('code')
const Lab = require('lab')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
require('sinon-as-promised')

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const beforeEach = lab.beforeEach
const expect = Code.expect

const Application = require('../lib/application.js')
const Context = require('../lib/context.js')

describe('Context', function () {
  let ctx

  // tests
  beforeEach(function (done) {
    ctx = {}
    done()
  })

  describe('constructor', function () {
    beforeEach(function (done) {
      ctx.queueName = 'queue-name'
      ctx.message = {
        fields: {
          deliveryTag: 1
        }
      }
      ctx.app = new Application()
      ctx.app.connection = {}
      ctx.app.consumerChannel = {}
      ctx.app.publisherChannel = {}
      ctx.app.context = { appFoo: 1, app: 'no' }
      ctx.queueOpts = { exclusive: true }
      ctx.consumeOpts = { noAck: true }
      ctx.app.queue(ctx.queueName, ctx.queueOpts, ctx.consumeOpts, function * () {})
      done()
    })

    it('should create a context', function (done) {
      const app = ctx.app
      const context = new Context(ctx.app, ctx.queueName, ctx.message)
      // expect context to be added on the message
      expect(ctx.message.context).to.equal(context)
      // expect context to copy app properties
      expect(context.appFoo).to.equal(ctx.app.context.appFoo)
      expect(context.app).to.equal(app)
      expect(context.connection).to.equal(app.connection)
      expect(context.consumerChannel).to.equal(app.consumerChannel)
      expect(context.publisherChannel).to.equal(app.publisherChannel)
      // expect context properties
      expect(context.queueName).to.equal(ctx.queueName)
      expect(context.message).to.equal(ctx.message)
      expect(context.deliveryTag).to.equal(ctx.message.fields.deliveryTag)
      expect(context.queueOpts).to.contain(ctx.queueOpts)
      expect(context.consumeOpts).to.contain(ctx.consumeOpts)
      expect(context.state).to.deep.equal({})
      // ack, nack, ackAll, nackAll tested below
      done()
    })
  })

  describe('instance methods', function () {
    beforeEach(function (done) {
      ctx.queueName = 'queue-name'
      ctx.message = {
        fields: {
          deliveryTag: 1
        }
      }
      ctx.app = new Application()
      ctx.app.connection = {}
      ctx.app.consumerChannel = {}
      ctx.app.publisherChannel = {}
      ctx.app.context = { appFoo: 1, app: 'no' }
      ctx.queueOpts = { exclusive: true }
      ctx.consumeOpts = { noAck: true }
      ctx.app.queue(ctx.queueName, ctx.queueOpts, ctx.consumeOpts, function * () {})
      // create context
      ctx.amqplibRpc = {
        request: sinon.stub(),
        reply: sinon.stub()
      }
      ctx.Context = proxyquire('../lib/context.js', {
        'amqplib-rpc': ctx.amqplibRpc
      })
      ctx.context = new ctx.Context(ctx.app, ctx.queueName, ctx.message)
      done()
    })

    describe('ack, nack, ackAll, nackAll', function () {
      describe('set and get', function (done) {
        it('should set hidden method and args', function (done) {
          let val
          val = {
            allUpTo: true
          }
          ctx.context.ack = val
          expect(ctx.context.ack).to.deep.equal(val)
          expect(ctx.context.nack).to.not.exist()
          expect(ctx.context.ackAll).to.not.exist()
          expect(ctx.context.nackAll).to.not.exist()
          val = {
            allUpTo: true,
            requeue: true
          }
          ctx.context.nack = val
          expect(ctx.context.nack).to.deep.equal(val)
          expect(ctx.context.ack).to.not.exist()
          expect(ctx.context.ackAll).to.not.exist()
          expect(ctx.context.nackAll).to.not.exist()
          val = true
          ctx.context.ackAll = val
          expect(ctx.context.ackAll).to.deep.equal({})
          expect(ctx.context.ack).to.not.exist()
          expect(ctx.context.nack).to.not.exist()
          expect(ctx.context.nackAll).to.not.exist()
          val = {
            requeue: true
          }
          ctx.context.nackAll = val
          expect(ctx.context.nackAll).to.deep.equal(val)
          expect(ctx.context.ack).to.not.exist()
          expect(ctx.context.ackAll).to.not.exist()
          expect(ctx.context.nack).to.not.exist()
          // unset w/ falsey
          ctx.context.nackAll = false
          expect(ctx.context.nackAll).to.not.exist()
          ctx.context.ack = false // coverage
          expect(ctx.context.ack).to.not.exist()
          done()
        })
      })

      describe('after onerror', function () {
        beforeEach(function (done) {
          sinon.stub(ctx.app, 'emit')
          ctx.Context.onerror(ctx.context)
          done()
        })

        it('should throw a special error when get/set ack,nack,..', function (done) {
          expect(function () {
            ctx.context.ack
          }).to.throw(/Ack.*not available/)
          done()
        })
      })
    })

    describe('publish', function () {
      beforeEach(function (done) {
        ctx.exchange = 'exchange'
        ctx.routingKey = 'routingKey'
        ctx.content = 'content'
        ctx.options = {}
        ctx.context.publisherChannel.publish = sinon.stub()
        done()
      })

      it('should publish on publisherChannel', function (done) {
        ctx.context.publish(ctx.exchange, ctx.routingKey, ctx.content, ctx.options)
        sinon.assert.calledOnce(ctx.context.publisherChannel.publish)
        sinon.assert.calledWith(
          ctx.context.publisherChannel.publish,
          ctx.exchange, ctx.routingKey, new Buffer(ctx.content), ctx.options)
        done()
      })
    })

    describe('sendToQueue', function () {
      beforeEach(function (done) {
        ctx.content = {foo: 1}
        ctx.options = {}
        ctx.context.publisherChannel.sendToQueue = sinon.stub()
        done()
      })

      it('should sendToQueue on publisherChannel', function (done) {
        ctx.context.sendToQueue(ctx.queueName, ctx.content, ctx.options)
        sinon.assert.calledOnce(ctx.context.publisherChannel.sendToQueue)
        sinon.assert.calledWith(
          ctx.context.publisherChannel.sendToQueue,
          ctx.queueName, new Buffer(JSON.stringify(ctx.content)), ctx.options)
        done()
      })
    })

    describe('reply', function () {
      beforeEach(function (done) {
        ctx.content = 'content'
        ctx.options = {}
        done()
      })

      it('should reply to an rpc request message', function (done) {
        ctx.context.reply(ctx.content, ctx.options)
        sinon.assert.calledOnce(ctx.amqplibRpc.reply)
        sinon.assert.calledWith(ctx.amqplibRpc.reply,
          ctx.context.publisherChannel,
          ctx.message,
          ctx.content,
          ctx.options)
        done()
      })
    })

    describe('request', function () {
      beforeEach(function (done) {
        ctx.content = 'content'
        ctx.sendOpts = {}
        ctx.queueOpts = {}
        ctx.consumeOpts = {}
        ctx.replyQueue = 'reply-queue'
        ctx.replyMessage = {
          properties: { correlationId: 1 },
          content: 'reply-content'
        }
        ctx.amqplibRpc.request.resolves(ctx.replyMessage)
        done()
      })

      it('should make a rpc request', function (done) {
        ctx.context.request(
          ctx.queueName,
          ctx.content,
          ctx.sendOpts,
          ctx.queueOpts,
          ctx.consumeOpts).then(function (replyMessage) {
            expect(replyMessage).to.equal(ctx.replyMessage)
            sinon.assert.calledOnce(ctx.amqplibRpc.request)
            sinon.assert.calledWith(ctx.amqplibRpc.request,
              ctx.app.connection,
              ctx.queueName,
              new Buffer(ctx.content),
              {
                sendOpts: {},
                queueOpts: {},
                consumeOpts: {}
              })
            done()
          }).catch(done)
      })
    })
  })
})
