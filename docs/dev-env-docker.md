# Dev Environment - docker

The purpose of this document is to explain how one can setup a connection to a private container registry for use within the devcontainer.

## Procedure

### Step 1 - update .env file

> [!TIP]
> This step is optional. If you don't want to track down values, then simply sign-into one password

`DOCKER_REGISTRY` - This value should be set to the registry URL: `harbor.local.abbottland.io`

`DOCKER_USERNAME` - This is the username to be used for `docker login`

`DOCKER_PASSWORD` - This is the password to be used with `docker login`


> [!NOTE]
> Be sure to restart the devcontainer if you change any of these values

### Step 2 - Log into docker

This script will use 1Password if the environment variables are not set.

1Password will not be used if all the environment variables are set, which may be useful in CI/CD

```sh
./scripts/docker-login.sh
```