import { defineCommand } from '@crustjs/core'
import { existsSync } from 'node:fs'
import { loadConfig } from '../config.ts'
import { branchExists, git, gitInherit, isAncestor, isDirty, listWorktrees, repoRoot, shortSha, type WorktreeEntry } from '../git.ts'
import { isInside, samePath, worktreePath } from '../worktree.ts'
import { removeWorktree } from './remove.ts'

export interface FoldOptions {
  into?: string
  remove: boolean
  force: boolean
  deleteBranch: boolean
}

interface FoldPlan {
  root: string
  target: string
  dir: string
  entries: WorktreeEntry[]
}

// All checks run before any ref moves, so a refused fold leaves the repo untouched.
async function planFold(cwd: string, branch: string, options: FoldOptions): Promise<FoldPlan> {
  if (!options.remove && (options.force || options.deleteBranch)) {
    throw new Error('--force and --delete-branch require --remove')
  }
  const root = await repoRoot(cwd)
  const { config } = await loadConfig(root)
  const target = options.into ?? config.base
  if (branch === target) throw new Error(`cannot fold ${target} into itself`)

  const dir = worktreePath(root, config, branch)
  const entries = await listWorktrees(root)
  if (!entries.some((wt) => samePath(wt.path, dir)) || !existsSync(dir)) {
    throw new Error(`No worktree for ${branch} at ${dir}`)
  }
  if (options.remove && isInside(cwd, dir)) {
    throw new Error(`Cannot remove the worktree you are in, leave ${dir} first`)
  }
  if (!(await branchExists(target, root))) {
    throw new Error(`target '${target}' not found, set base in worktree config or pass --into`)
  }
  if (await isDirty(dir)) {
    throw new Error(`${branch} has uncommitted changes, commit them before folding`)
  }
  if (!(await isAncestor(target, branch, root))) {
    throw new Error(`${branch} is not a fast-forward of ${target}, rebase it first (cd ${dir} && git rebase ${target})`)
  }
  return { root, target, dir, entries }
}

async function fastForward(plan: FoldPlan, branch: string): Promise<void> {
  const holder = plan.entries.find((wt) => wt.branch === plan.target)
  if (holder) {
    // Merging inside the worktree that has the target checked out keeps its files in sync with the ref.
    await gitInherit(['merge', '--ff-only', branch], holder.path)
  } else {
    await git(['fetch', '.', `refs/heads/${branch}:refs/heads/${plan.target}`], plan.root)
  }
}

export async function foldWorktree(cwd: string, branch: string, options: FoldOptions): Promise<void> {
  const plan = await planFold(cwd, branch, options)
  const before = await shortSha(plan.target, plan.root)
  const after = await shortSha(branch, plan.root)

  if (before === after) {
    console.log(`${plan.target} is already up to date with ${branch}`)
  } else {
    await fastForward(plan, branch)
    console.log(`Folded ${branch} into ${plan.target} (${before}..${after})`)
  }

  if (!options.remove) return
  try {
    await removeWorktree(cwd, branch, { force: options.force, deleteBranch: options.deleteBranch })
  } catch (err) {
    throw new Error(`Folded ${branch} into ${plan.target}, but removal failed: ${(err as Error).message}; run work3 rm ${branch} to retry`)
  }
}

export const foldCommand = defineCommand('fold', { description: 'Fast-forward the base branch onto a worktree branch' }, (cmd) =>
  cmd
    .args({ name: 'branch', type: 'string', description: 'Branch name', required: true })
    .flags({
      into: { type: 'string', description: 'Target branch (default: config base)' },
      remove: { type: 'boolean', short: 'r', noNegate: true, description: 'Remove the worktree after folding' },
      force: { type: 'boolean', short: 'f', noNegate: true, description: 'With --remove: ignore failing destroy tasks' },
      'delete-branch': { type: 'boolean', short: 'd', noNegate: true, description: 'With --remove: also delete the branch' },
    })
    .action(async ({ args, flags }) => {
      await foldWorktree(process.cwd(), args.branch, {
        into: flags.into,
        remove: flags.remove ?? false,
        force: flags.force ?? false,
        deleteBranch: flags['delete-branch'] ?? false,
      })
    }),
)
