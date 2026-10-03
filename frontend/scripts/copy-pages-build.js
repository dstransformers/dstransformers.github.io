import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const frontendDirectory = resolve(scriptDirectory, '..')
const buildDirectory = resolve(frontendDirectory, 'dist')
const pagesAdminDirectory = resolve(frontendDirectory, '..', 'admin')

rmSync(pagesAdminDirectory, { recursive: true, force: true })
mkdirSync(pagesAdminDirectory, { recursive: true })
cpSync(buildDirectory, pagesAdminDirectory, { recursive: true })
