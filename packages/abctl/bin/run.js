#!/usr/bin/env node
/* eslint-disable no-undef */

import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'
import {existsSync} from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '../src')

// If src/ exists, we're in development - use dev.js
if (existsSync(srcDir)) {
  await import('./dev.js')
} else {
  // Production - run compiled code
  const {run} = await import('@oclif/core')
  await run(process.argv.slice(2), import.meta.url)
}
