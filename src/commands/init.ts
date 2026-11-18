import { defineCommand } from '@crustjs/core'
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { findConfigFiles } from '../config.ts'
import { branchExists, currentBranch, isIgnored, repoRoot } from '../git.ts'
import { isInside } from '../worktree.ts'

const LOCATION = 'worktrees'

function renderConfig(base: string, yaml: boolean): string {
  if (yaml) {
    // JSON strings are valid YAML scalars, which keeps odd branch names safe.
    return `location: ${JSON.stringify(LOCATION)}\nbase: ${JSON.stringify(base)}\ninitialize: []\ndestroy: []\n`
  }
  return `${JSON.stringify({ location: LOCATION, base, initialize: [], destroy: [] }, null, 2)}\n`
}

async function ensureIgnored(root: string, location: string): Promise<boolean> {
  const dir = resolve(root, location)
  if (!isInside(dir, root) || dir === root) return false
  const rel = relative(root, dir).replace(/\\/g, '/')
  if (await isIgnored(`${rel}/`, root)) return false
  const file = join(root, '.gitignore')
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const prefix = current && !current.endsWith('\n') ? '\n' : ''
  appendFileSync(file, `${prefix}/${rel}/\n`)
  return true
}

export async function initRepo(cwd: string, yaml: boolean): Promise<string> {
  const root = await repoRoot(cwd)
  const existing = findConfigFiles(root)
  if (existing.length) {
    throw new Error(`Config already exists: ${existing.join(', ')}`)
  }
  const base = (await branchExists('main', root)) ? 'main' : (await currentBranch(root)) || 'main'
  const file = join(root, yaml ? 'worktree.yaml' : 'worktree.json')
  writeFileSync(file, renderConfig(base, yaml))
  console.log(`Created ${file} (base: ${base})`)
  if (await ensureIgnored(root, LOCATION)) {
    console.log(`Added /${LOCATION}/ to .gitignore`)
  }
  return file
}

export const initCommand = defineCommand('init', { description: 'Create a worktree config in the current repository' }, (cmd) =>
  cmd
    .flags({
      yaml: { type: 'boolean', noNegate: true, description: 'Write worktree.yaml instead of worktree.json' },
    })
    .action(async ({ flags }) => {
      await initRepo(process.cwd(), flags.yaml ?? false)
    }),
)
