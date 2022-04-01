const shimmer = require('shimmer');
const { plugins, constants } = require('hato');
const { Scopes: { CONNECTION, SUBSCRIPTION } } = constants;

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
        this.scopes[CONNECTION] = this.onConnect();
        this.hooks[CONNECTION] = this.onOpen();
    }

    destroy() {
        if (this.unpatch) this.unpatch();
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
            this.unpatch = this.patchConnection(connection);
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

    patchSendMessage(original) {
        const plugin = this;
        return function loggedSendMessage() {
            // Log with the provided function
            try {
                const [, , fields, , properties, content] = arguments;
                plugin.log('info', {
                    ...this.connFields,
                    command: 'publish',
                    exchange: fields.exchange,
                    routingKey: fields.routingKey,
                    properties,
                    content: plugin.serializeContent(content)
                }, 'Message published.');
            } catch (err) {
                plugin.log('warn', { err }, '[AMQP:log] Message logging failed.');
            }
            return original.apply(this, arguments);
        };
    }

    patchConnection(connection) {
        shimmer.wrap(
            connection.constructor.prototype,
            'sendMessage',
            this.patchSendMessage.bind(this));
        return () => shimmer.unwrap(
            connection.constructor.prototype,
            'sendMessage',
            this.patchSendMessage.bind(this));
    }

};
