#!make

.PHONY: deps test coverage lint lint-fix

export NODE_ENV ?= test

node_modules: package.json
	@npm install
	@npm install hato

deps: node_modules

test:
	@npx mocha "test/**/*.js" "src/**/*.spec.js"

tdd:
	@npx mocha "test/**/*.js" "src/**/*.spec.js" --watch

coverage:
	@npx nyc -x "test/*" -x "src/**/*.spec.js" --reporter=lcov --reporter=text-lcov --reporter=text $(MAKE) -s test

lint:
	@npx eslint src

lint-fix:
	@npx eslint src --fix
