# Dev Guide - Build with Typescript

The purpose of this document is to explain how one can run typescript builds in this project.

## Overview

This project has been set up with `turborepo` so you can run `pnpm build` from the root of this project and it will go into each app and package that needs building and will do so!

Alternatively, you can run `cd apps/[app-name]` and then run `pnpm build` from there to just run one at-a-time.

Each package is configured to output to a `dist/` directory
