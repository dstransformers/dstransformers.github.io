import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const frontendDirectory = resolve(scriptDirectory, '..')
const buildDirectory = resolve(frontendDirectory, 'dist')
const pagesRootDirectory = resolve(frontendDirectory, '..')

mkdirSync(pagesRootDirectory, { recursive: true })
cpSync(buildDirectory, pagesRootDirectory, { recursive: true })
