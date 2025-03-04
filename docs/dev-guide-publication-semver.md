# Dev Guide - Publication Semantic Versioning

The purpose of this document is to explain how you can version major, minor, or patch version of each package in preparation for them to be later published to either the npm or docker registries.

## 1- Create a changeset

Create a changeset. This will create temporary files in `.changeset` and offer an interactive experience to generate these files.

In the interactive experience you can choose which packages have changed and by some amount.

```sh
pnpm changeset
```

The pending change will be in `.changeset/[random-name].md`.

> [!NOTE]
> This file with the randomly generated name can be edited to add a better description of the release.

## 2- Version bump `package.json` files

Once you have a changeset you can then bump the version of various packages that need changing.

```sh
pnpm changeset version
```

This will do the following:

- Remove the temporary `.changeset/[random-name].md` file
- Issue version bumps to each affected `package.json`
  - As specified in the changeset markdown file.
- Write data to each `package-name/CHANGELOG.md`

> [!IMPORTANT]
> A commit is not made for this process, so you'll want to commit and push using `git`
