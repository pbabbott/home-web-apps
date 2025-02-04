# Dev Environment - npm

The purpose of this document is to explain how one can setup a connection to a private npm registry for use within the devcontainer.

## Procedure

### Step 1 - notice registry settings

This project is set up to work with a private registry located at `https://verdaccio.local.abbottland.io`

This value is set in the `.devcontainer/.env` file and in the root `.npmrc` file.

### Step 2 - update .env file

> [!TIP]
> This step is optional. If you don't want to track down values, then simply [sign into 1password](./dev-env-op.md), and values will be fetched automatically

`NPM_USERNAME` - This is the username to be used with `pnpm login`

`NPM_PASSWORD` - This is the password to be used with `pnpm login`

> [!NOTE]
> Be sure to restart the devcontainer if you change any of these values

### Step 2 - Log into npm registry

This script will use 1Password if the environment variables are not set.

1Password will not be used if all the environment variables are set, which may be useful in CI/CD

```sh
./scripts/npm-login.sh
```
