const Args = require('amqplib/lib/api_args');
const { plugins, constants } = require('hato');
const { Scopes: { CONNECTION, SUBSCRIPTION, PUBLICATION } } = constants;

module.exports = class extends plugins.Base {

    constructor(options = {}) {
        super('log');

        if (typeof options === 'function') {
            options = { log: options };
        }
        this.options = options;

        this.connFields = {};
    }

    init() {
        this.logger = this.options.logger || this.logger;
        this.log = this.options.log ||
            ((level, struct, msg) => this.logger[level](struct, msg));

        this.scopes[SUBSCRIPTION] = this.onConsume();
        this.scopes[PUBLICATION] = this.onPublish();
        this.scopes[CONNECTION] = this.onConnect();
        this.hooks[CONNECTION] = this.onOpen();
    }

    onConnect() {
        return (connect) => (url, socketOptions) => {
            this.extractProtocol(url);
            return connect(url, socketOptions);
        };
    }

    onOpen() {
        return (conn) => {
            const { connection } = conn,
                { stream: socket, serverProperties } = connection;
            this.log('debug', { serverProperties }, 'Connected to broker.');
            Object.assign(this.connFields, {
                protocolVersion: '0.9.1',
                localAddress: socket.localAddress,
                localPort: socket.localPort,
                remoteAddress: socket.remoteAddress,
                remotePort: socket.remotePort,
                system: `${serverProperties.product} ${serverProperties.version}`
            });
        };
    }

    onConsume() {
        const plugin = this;
        return (consume) => (queue, fn, options) => {
            const handler = function(msg) {
                const { fields, properties, content } = msg;
                // Log with the provided function
                try {
                    plugin.log('info', {
                        ...plugin.connFields,
                        command: 'consume',
                        exchange: fields.exchange,
                        routingKey: fields.routingKey,
                        options,
                        fields,
                        properties,
                        content: plugin.serializeContent(content)
                    }, 'Message delivered.');
                } catch (err) {
                    plugin.log('warn', { err }, '[AMQP:log] Message logging failed.');
                }

                return fn(msg);
            };
            return consume(queue, handler, options);
        };
    }

    logPublish(exchange, routingKey, content, options, err) {
        // Log with the provided function
        try {
            const properties = Args.publish(exchange, routingKey, options);
            this.log('info', {
                ...this.connFields,
                err,
                command: 'publish',
                exchange,
                routingKey,
                properties: {
                    ...properties,
                    headers: Object.getPrototypeOf(properties.headers)
                },
                content: this.serializeContent(content)
            }, 'Message published.');
        } catch (err) {
            this.log('warn', { err }, '[AMQP:log] Message logging failed.');
        }
    }

    onPublish() {
        const plugin = this;
        return (publish) => (exchange, routingKey, content, options, cb) => {
            if (typeof cb !== 'function') {
                plugin.logPublish(exchange, routingKey, content, options);
                return publish(exchange, routingKey, content, options);
            }
            return publish(exchange, routingKey, content, options, function(err) {
                cb(err);
                plugin.logPublish(exchange, routingKey, content, options, err);
            });
        };
    }

    extractProtocol(url) {
        if (typeof url === 'object') {
            this.connFields.protocol = url.protocol;
        } else if (typeof url === 'string') {
            url = new URL(url);
            this.connFields.protocol = url.protocol.replace(/:$/, '');
        }
    }

    serializeContent(content) {
        try {
            const buf = Buffer.isBuffer(content) ?
                content : JSON.stringify(content);
            const {
                enabled = false,
                maxBytes = 1000
            } = this.options.body || {};
            if (!enabled || buf.length > maxBytes) return;
            try {
                return JSON.parse(buf);
            } catch {
                return buf.toString('utf8');
            }
        } catch {
            return undefined;
        }
    }

};
