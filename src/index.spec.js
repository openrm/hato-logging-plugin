const assert = require('assert');
const EventEmitter = require('events');

const { Client, plugins } = require('hato');
const Log = require('.');

// Externally resolvable promise
class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });

        this.then = this.promise.then.bind(this.promise);
        this.catch = this.promise.catch.bind(this.promise);
    }
}

describe('log plugin', () => {
    let client;
    let emitter;

    beforeEach(async() => {
        emitter = new EventEmitter();

        const logger = (level, data) => {
            emitter.emit('log', data);
        };

        client = await new Client('amqp://guest:guest@127.0.0.1:5672', {
            plugins: [new plugins.Encoding('json'), new Log({ log: logger, body: { enabled: true } })]
        })
            .start();
    });

    afterEach(() => client.close());

    describe('publishes', () => {
        it('it should log messages published to a direct exchange', (done) => {
            const deferred = new Deferred();

            // Ensure logged data is as expected
            const check = (data) => {
                assert.deepStrictEqual(data.content, { string: 'string' });
                assert.strictEqual(data.routingKey, 'a.routing.key');
                assert.strictEqual(data.exchange, 'amq.direct');
                assert.strictEqual(data.command, 'publish');
                assert.strictEqual(data.properties.contentType, 'application/json');
                assert.deepStrictEqual(data.properties.headers, { 'x-test': 'true' });
            };

            // Message is logged twice, once when published, once when consumed and acknowledged
            emitter.once('log', (data) => deferred.then(() => {
                try {
                    check(data);
                    done();
                } catch (error) {
                    done(error);
                }
            }));

            // Publish message
            client
                .type('direct')
                .publish('a.routing.key', { string: 'string' }, { headers: { 'x-test': 'true' } })
                .then(deferred.resolve)
                .catch(done);
        });

        it('it should log messages published to a topic exchange', (done) => {
            const deferred = new Deferred();

            // Ensure logged data is as expected
            const check = (data) => {
                assert.deepStrictEqual(data.content, { string: 'string' });
                assert.strictEqual(data.routingKey, 'a.routing.key');
                assert.strictEqual(data.exchange, 'amq.topic');
                assert.strictEqual(data.command, 'publish');
            };

            // Message is logged twice, once when published, once when consumed and acknowledged
            emitter.once('log', (data) => deferred.then(() => {
                try {
                    check(data);
                    done();
                } catch (error) {
                    done(error);
                }
            }));

            // Subscribe and acknowledge message
            client
                .queue('foo', { durable: false, exclusive: true })
                .subscribe('a.routing.key', (msg) => msg.ack())
                .on('error', done);

            // Publish message
            client
                .type('topic')
                .publish('a.routing.key', { string: 'string' })
                .then(deferred.resolve)
                .catch(done);
        });
    });

    describe('consumption', () => {
        it('it should log messages consumed', (done) => {
            // Ensure logged data is as expected
            const check = (data) => {
                assert.deepStrictEqual(data.content, { string: 'string' });
                assert.strictEqual(data.routingKey, 'a.routing.key');
                assert.strictEqual(data.exchange, 'amq.topic');
                assert.strictEqual(data.command, 'consume');
                assert.strictEqual(data.properties.contentType, 'application/json');
                done();
            };

            // Check the message when it is logged
            emitter.on('log', (data) => {
                if (data.command === 'consume') check(data);
            });

            // Subscribe and acknowledge message
            client
                .type('topic')
                .queue('foo', { durable: false, exclusive: true })
                .subscribe('a.routing.key', (msg) => {
                    msg.ack();
                })
                .on('error', done);

            // Publish message
            client
                .type('topic')
                .publish('a.routing.key', { string: 'string' })
                .catch(done);
        });
    });
});
