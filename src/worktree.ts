import { basename, isAbsolute, relative, resolve } from 'node:path'
import type { Config } from './config.ts'

export function safeName(branch: string): string {
  return branch.replace(/[\\/]/g, '--')
}

export function worktreesDir(root: string, config: Config): string {
  return resolve(root, config.location)
}

export function worktreePath(root: string, config: Config, branch: string): string {
  return resolve(worktreesDir(root, config), safeName(branch))
}

export function sessionName(root: string, branch: string): string {
  return `${basename(root)}/${branch}`
}

export function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export function samePath(a: string, b: string): boolean {
  const left = resolve(a)
  const right = resolve(b)
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right
}
