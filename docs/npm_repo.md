# Connect to an NPM Registry

In order to work with this project and NPM, you'll want to connect to an artifact registry.  This guide explains how to setup a registry on your local development machine, or how to connect to a registry on the network.

## Table of Contents
- [Connect to an NPM Registry](#connect-to-an-npm-registry)
  - [Table of Contents](#table-of-contents)
  - [Environment Variables](#environment-variables)
    - [Host Machine Environment Variables](#host-machine-environment-variables)
      - [`NPM_REGISTRY_PROTO`](#npm_registry_proto)
      - [`NPM_REGISTRY`](#npm_registry)
      - [`NPM_TOKEN`](#npm_token)
    - [Docker Environment Variables](#docker-environment-variables)
      - [`DOCKER_NPM_REGISTRY_PROTO`](#docker_npm_registry_proto)
      - [`DOCKER_NPM_REGISTRY`](#docker_npm_registry)
      - [`DOCKER_NPM_TOKEN`](#docker_npm_token)
    - [Docker Environment Variables](#docker-environment-variables-1)
  - [Local Registry](#local-registry)
  - [Network Registry](#network-registry)
  - [Host Machine Test](#host-machine-test)


## Environment Variables

The following environment variables need to be set in order to interact with this project.

All of these variables are used in the `.npmrc` file.

### Host Machine Environment Variables

These variables are used on the host machine

#### `NPM_REGISTRY_PROTO`

This should be set to `http` or `https`

#### `NPM_REGISTRY`

This should be the URI of the registry.  

For example:

`verdaccio.nas.local.abbottland.io`

#### `NPM_TOKEN`

This should be an auth token to identify the user interacting with the artifact repository.

### Docker Environment Variables


#### `DOCKER_NPM_REGISTRY_PROTO`

Same as above...

#### `DOCKER_NPM_REGISTRY`

Same as above...

#### `DOCKER_NPM_TOKEN`

Same as above...

### Docker Environment Variables

These variables are used in the docker build context. These can be useful to connect to other things in docker.

## Local Registry

First, run verdaccio in a container via:

```sh
docker run -d -p 4873:4873 --restart=always --name verdaccio verdaccio/verdaccio
```

Next, Set environment variables
```env
NPM_REGISTRY_PROTO='http'
NPM_REGISTRY='localhost:4873'
NPM_TOKEN=''

DOCKER_NPM_REGISTRY_PROTO='http'
DOCKER_NPM_REGISTRY='host.docker.internal:4873'
DOCKER_NPM_TOKEN=''
```

## Network Registry

Next, authenticate to private registry by setting the following environment variables:
```env
NPM_REGISTRY_PROTO='https'
NPM_REGISTRY='verdaccio.nas.local.abbottland.io'
NPM_TOKEN='ASK_PEER_DEVELOPER_FOR_THIS_VALUE'

DOCKER_NPM_REGISTRY_PROTO='https'
DOCKER_NPM_REGISTRY='host.docker.internal:4873'
DOCKER_NPM_TOKEN='ASK_PEER_DEVELOPER_FOR_THIS_VALUE'
```

## Host Machine Test
Whether you connect with either a local registry or network registry.  Make sure you can restore packages!

Then, restore packages with `yarn`

```bash
yarn
```