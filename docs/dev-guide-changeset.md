
## Create a changeset

Create a changeset.  This will create temporary files in `.changeset` and offer an interactive experience to generate these files.

In the interactive experience you can choose which packages have changed and by some amount.

```sh
pnpm changeset
```

The pending change will be in `.changeset/[random-name].md`


## Issue version bumps

Once you have a changeset you can then bump the version of various packages that need changing.

```sh
pnpm changeset version
```

This will do the following
- Remove the temporary `.changeset/[random-name].md` file
- Issue version bumps to each affected `package.json`
- Write data to each `package-name/CHANGELOG.md`
  - note: a commit is not made for this


## Issue publication

```sh
pnpm changeset publish
```

This is basically the same as going into each package and running `pnpm publish --registry=https://verdaccio.local.abbottland.io`

It will check to see if the package exists in the remote registry, and if it does not, it will try to push it to remote.