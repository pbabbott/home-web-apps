## Dev Guide - Publication to NPM

The purpose of this document is to demonstrate how one can publish a new version of a package to the remote npm registry.

## Procedure 

>[!TIP]
> For these steps, you'll want to make sure you're [logged into npm](./dev-env-npm.md) and you have no working changes with `git`

### Step 1 - Issue version

This procedure is based on the `changeset` tool. Be sure to follow the steps in  [Dev Guide - Versioning](./dev-guide-versioning.md) first.

###  Step 2 - Build

Be sure to run a build so that various `dist/` directories are up-to-date.


###  Step 3 - Publish to NPM

Now that packages have been versioned, and you have a fresh build, you can now publish any packages that have not yet made their way to the remote registry.

```sh
pnpm changeset publish
```

This is basically the same as going into each package and running `pnpm publish --registry=https://verdaccio.local.abbottland.io`

The only difference is that it will check to see if the package exists in the remote registry, and if it does not, it will try to push it to remote.

> [!TIP]
> This command works because there is an environment variable called `npm_config_registry` set in the `.devcontainer/.env` indicating which registry we should publish to.