# Dev Guide - Build with Docker

The purpose of this document is to explain how one can run docker builds in this project.

## Overview

This project has been set up with `turborepo` so you can run `pnpm docker:build` from the root of this project and it will go into each app and package that needs building and will do so!

Alternatively, you can run `cd [project-dir]/[project-name]` and then run `pnpm docker:build` from there to just run one at-a-time.

## Setup

Each package should have a script named `docker:build` and `docker:push` and it should call a shell script located in  `scripts/docker-build.sh` (or `scripts/docker-push.sh`)

Abstract example:
```json
"docker:build": "../../scripts/docker-build.sh [project-dir] [project-name]",
"docker:push": "../../scripts/docker-push.sh [project-dir] [project-name]",
```

Tangible example:

```json
// Notice the empty space between "apps/" and "gluetun-sync"
"docker:build": "../../scripts/docker-build.sh apps/ gluetun-sync",
"docker:push": "../../scripts/docker-push.sh apps/ gluetun-sync",
```
