# hato-logging-plugin

[![CircleCI](https://img.shields.io/circleci/build/github/openrm/hato)](https://app.circleci.com/pipelines/github/openrm/hato-logging-plugin?branch=master)
[![Maintainability](https://api.codeclimate.com/v1/badges/87ff47742751f9a49a6b/maintainability)](https://codeclimate.com/github/openrm/hato-logging-plugin/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/87ff47742751f9a49a6b/test_coverage)](https://codeclimate.com/github/openrm/hato-logging-plugin/test_coverage)
[![GitHub license](https://img.shields.io/github/license/openrm/hato-logging-plugin)](https://github.com/openrm/hato-logging-plugin/blob/master/LICENSE)

A plugin for logging messages passing through hato

## About
This is a plugin for [hato](https://github.com/openrm/hato), an amqp framework.

This plugin facilitates logging of messages that are published and consumed by hato.

The plugin accepts a logging function to which messages will be passed as they are published and consumed. The passed logging function should accept one argument which will be passed in the following format:

```
{
    command, // Either 'publish' or 'consume'
    exchange,
    routingKey,
    content
}
```

## Getting Started

Import the package

```js
const Logging = require('hato-logging-plugin');
```

Instantiate the logging plugin with a logging function of your choice, if left empty the default is `console.log`
```js
const MyLogger = new Logging(console.log);
```

Construct a new client including the logging plugin
```js
const client = new Client(BROKER_URL, {
    plugins: [
        ...,
        MyLogger
    ],
});
```

## Running Tests

Make sure you have a message broker running. The tests expect [RabbitMQ](https://www.rabbitmq.com/).

```sh
$ docker run -it --name rabbitmq -p 5672:5672 rabbitmq:3.6-alpine
```
Then run
```sh
$ make test
$ make lint
```

## License
[MIT](https://github.com/openrm/hato/blob/master/LICENSE)
