import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/cache') {
    return {
      url: 'data:text/javascript,export function revalidatePath(){}; export function revalidateTag(){}; export function unstable_cache(fn){return fn};',
      shortCircuit: true,
    }
  }
  if (specifier === 'next/navigation') {
    return {
      url: 'data:text/javascript,export function redirect(){}; export function useRouter(){return {}}; export function usePathname(){return ""}; export function useSearchParams(){return new URLSearchParams()};',
      shortCircuit: true,
    }
  }
  if (specifier === 'next/headers') {
    return {
      url: 'data:text/javascript,export async function cookies(){ return { getAll: () => [], get: () => null, set: () => {} } }; export async function headers(){ return new Headers() };',
      shortCircuit: true,
    }
  }
  if (specifier === 'next/server') {
    return {
      url: 'data:text/javascript,export function after(fn){ if(typeof fn==="function") fn(); }; export class NextResponse {};',
      shortCircuit: true,
    }
  }

  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      // Handle relative imports
      if (specifier.startsWith('.')) {
        const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd()
        const parentDir = path.dirname(parentPath)
        const basePath = path.resolve(parentDir, specifier)
        for (const ext of ['.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.js']) {
          const testPath = basePath + ext
          if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
            return nextResolve(pathToFileURL(testPath).href, context)
          }
        }
      }
      // Handle @/ alias
      if (specifier.startsWith('@/')) {
        const relativePart = specifier.slice(2)
        const basePath = path.resolve(process.cwd(), relativePart)
        for (const ext of ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.js']) {
          const testPath = basePath + ext
          if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
            return nextResolve(pathToFileURL(testPath).href, context)
          }
        }
      }
    }
    throw err
  }
}
