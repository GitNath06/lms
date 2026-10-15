import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'

const rootDir = process.cwd()

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/cache') {
    return nextResolve(pathToFileURL(path.resolve(rootDir, 'node_modules/next/cache.js')).href, context)
  }
  if (specifier === 'next/server') {
    return nextResolve(pathToFileURL(path.resolve(rootDir, 'node_modules/next/server.js')).href, context)
  }
  if (specifier === 'next/headers') {
    return nextResolve(pathToFileURL(path.resolve(rootDir, 'node_modules/next/headers.js')).href, context)
  }
  if (specifier === 'next/navigation') {
    return nextResolve(pathToFileURL(path.resolve(rootDir, 'node_modules/next/navigation.js')).href, context)
  }

  if (specifier.startsWith('@/')) {
    const subpath = specifier.slice(2)
    let fullPath = path.resolve(rootDir, subpath)

    if (!fs.existsSync(fullPath)) {
      for (const ext of ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']) {
        if (fs.existsSync(fullPath + ext)) {
          fullPath = fullPath + ext
          break
        }
      }
    }

    return nextResolve(pathToFileURL(fullPath).href, context)
  }

  return nextResolve(specifier, context)
}
