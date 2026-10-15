import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./tests/resolve-hook.mjs', pathToFileURL('./'))
