import { defineCommand } from '@crustjs/core'
import { existsSync } from 'node:fs'
import { loadConfig } from '../config.ts'
import { gitInherit, isDirty, listWorktrees, repoRoot } from '../git.ts'
import { runTasks } from '../tasks.ts'
import { isInside, samePath, worktreePath } from '../worktree.ts'

export interface RemoveOptions {
  force: boolean
  deleteBranch: boolean
}

export async function removeWorktree(cwd: string, branch: string, options: RemoveOptions): Promise<void> {
  const root = await repoRoot(cwd)
  const { config } = await loadConfig(root)
  const dir = worktreePath(root, config, branch)

  const entry = (await listWorktrees(root)).find((wt) => samePath(wt.path, dir))
  if (!entry) throw new Error(`No worktree for ${branch} at ${dir}`)
  if (isInside(cwd, dir)) throw new Error(`Cannot remove the worktree you are in, leave ${dir} first`)

  if (existsSync(dir)) {
    // Checked before destroy tasks so a refused removal does not leave half torn down resources.
    if (!options.force && (await isDirty(dir))) {
      throw new Error(`${dir} has uncommitted or untracked changes, use --force to remove anyway`)
    }
    await runTasks(config.destroy, { root, path: dir, branch }, { continueOnError: options.force })
  } else {
    console.warn(`warning: ${dir} is missing, skipping destroy tasks`)
  }

  await gitInherit(['worktree', 'remove', ...(options.force ? ['--force'] : []), dir], root)
  console.log(`Removed ${dir}`)

  if (options.deleteBranch) {
    await gitInherit(['branch', options.force ? '-D' : '-d', branch], root)
  }
}

export const removeCommand = defineCommand('remove', { description: 'Run destroy tasks and remove a worktree', aliases: ['rm'] }, (cmd) =>
  cmd
    .args({ name: 'branch', type: 'string', description: 'Branch name', required: true })
    .flags({
      force: { type: 'boolean', short: 'f', noNegate: true, description: 'Ignore dirty state and failing destroy tasks' },
      'delete-branch': { type: 'boolean', short: 'd', noNegate: true, description: 'Also delete the branch' },
    })
    .action(async ({ args, flags }) => {
      await removeWorktree(process.cwd(), args.branch, {
        force: flags.force ?? false,
        deleteBranch: flags['delete-branch'] ?? false,
      })
    }),
)
