import { defineCommand } from '@crustjs/core'
import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { loadConfig } from '../config.ts'
import { isDirty, listWorktrees, repoRoot, type WorktreeEntry } from '../git.ts'
import { isInside, samePath, worktreesDir } from '../worktree.ts'

export interface ListedWorktree extends WorktreeEntry {
  status: 'clean' | 'dirty' | 'missing'
}

export async function managedWorktrees(cwd: string): Promise<{ root: string; worktrees: ListedWorktree[] }> {
  const root = await repoRoot(cwd)
  const { config } = await loadConfig(root)
  const dir = worktreesDir(root, config)
  const entries = (await listWorktrees(root)).filter((entry) => isInside(entry.path, dir) && !samePath(entry.path, dir))
  const worktrees = await Promise.all(
    entries.map(async (entry): Promise<ListedWorktree> => {
      if (!existsSync(entry.path)) return { ...entry, status: 'missing' }
      return { ...entry, status: (await isDirty(entry.path)) ? 'dirty' : 'clean' }
    }),
  )
  return { root, worktrees }
}

export const listCommand = defineCommand('list', { description: 'List managed worktrees', aliases: ['ls'] }, (cmd) =>
  cmd.action(async () => {
    const { root, worktrees } = await managedWorktrees(process.cwd())
    if (!worktrees.length) {
      console.log('No worktrees')
      return
    }
    const width = Math.max(...worktrees.map((wt) => (wt.branch ?? '(detached)').length))
    for (const wt of worktrees) {
      const branch = (wt.branch ?? '(detached)').padEnd(width)
      console.log(`${branch}  ${wt.status.padEnd(7)}  ${relative(root, wt.path)}`)
    }
  }),
)
