# @abbottland/abctl

Abbottland control CLI for common repository tasks

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@abbottland/abctl.svg)](https://npmjs.org/package/@abbottland/abctl)
[![Downloads/week](https://img.shields.io/npm/dw/@abbottland/abctl.svg)](https://npmjs.org/package/@abbottland/abctl)

<!-- toc -->
* [@abbottland/abctl](#abbottlandabctl)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @abbottland/abctl
$ abctl COMMAND
running command...
$ abctl (--version)
@abbottland/abctl/0.0.0 linux-x64 node-v22.18.0
$ abctl --help [COMMAND]
USAGE
  $ abctl COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`abctl docker build`](#abctl-docker-build)
* [`abctl docker publish`](#abctl-docker-publish)
* [`abctl help [COMMAND]`](#abctl-help-command)
* [`abctl secrets generate-env`](#abctl-secrets-generate-env)

## `abctl docker build`

Build a Docker image for the current project

```
USAGE
  $ abctl docker build [-c <value>]

FLAGS
  -c, --config=<value>  [default: ./abctl.yml] Path to the config file

DESCRIPTION
  Build a Docker image for the current project

EXAMPLES
  $ abctl docker build
  build the Docker image for the current project
```

## `abctl docker publish`

Publish a Docker image for the current project

```
USAGE
  $ abctl docker publish [-c <value>]

FLAGS
  -c, --config=<value>  [default: ./abctl.yml] Path to the config file

DESCRIPTION
  Publish a Docker image for the current project

EXAMPLES
  $ abctl docker publish
  publish the Docker image for the current project
```

## `abctl help [COMMAND]`

Display help for abctl.

```
USAGE
  $ abctl help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for abctl.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.35/src/commands/help.ts)_

## `abctl secrets generate-env`

Generate .env file from 1Password secrets

```
USAGE
  $ abctl secrets generate-env [-c <value>]

FLAGS
  -c, --config=<value>  [default: ./abctl.yml] Path to the config file

DESCRIPTION
  Generate .env file from 1Password secrets

EXAMPLES
  $ abctl secrets generate-env
```
<!-- commandsstop -->
