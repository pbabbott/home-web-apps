# Dev Guide - Linting

The purpose of this document is to explain how linting works in this repository.

## Overview

This project has been setup to work with `eslint` version 9.  Each package and app should be set up with linting

The whole project can be linted via `pnpm lint`

Individual packages can be linted via `cd packages/[name]` and then `pnpm lint` 

### VS Code

VS Code has been set up to detect linting issues in the `Problems` window pane via `dbaeumer.vscode-eslint`,  though linting issues will only show up there if a file is open.  This is because scanning the whole repository all the time is not a recommended strategy.  Instead, linting issues should be addressed as they will show up with red squiggles inline in code, and will be caught when running the lint command against the whole repository.

### Automation

Coming soon!