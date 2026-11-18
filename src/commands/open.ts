import { defineCommand } from '@crustjs/core'
import { existsSync } from 'node:fs'
import { loadConfig, type Config } from '../config.ts'
import { branchExists, gitInherit, gitRaw, listWorktrees, refExists, repoRoot } from '../git.ts'
import { runTasks } from '../tasks.ts'
import { samePath, sessionName, worktreePath } from '../worktree.ts'

export interface OpenOptions {
  from?: string
  claude: boolean
}

async function assertBranchName(branch: string, root: string): Promise<void> {
  if ((await gitRaw(['check-ref-format', '--branch', branch], root)).code !== 0) {
    throw new Error(`Invalid branch name: ${branch}`)
  }
}

async function createWorktree(root: string, config: Config, branch: string, dir: string, from?: string): Promise<void> {
  if (await branchExists(branch, root)) {
    if (from) console.warn(`warning: branch ${branch} already exists, ignoring --from ${from}`)
    await gitInherit(['worktree', 'add', dir, branch], root)
    return
  }
  const base = from ?? config.base
  if (!(await refExists(base, root))) {
    throw new Error(`base '${base}' not found, set base in worktree config or pass --from`)
  }
  await gitInherit(['worktree', 'add', '-b', branch, dir, base], root)
}

// Returns true when the worktree was created by this call.
async function ensureWorktree(root: string, config: Config, branch: string, dir: string, from?: string): Promise<boolean> {
  const existing = (await listWorktrees(root)).find((entry) => samePath(entry.path, dir))
  if (existing) {
    if (existing.branch !== branch) {
      throw new Error(`${dir} is checked out on ${existing.branch ?? 'a detached HEAD'}, not ${branch}`)
    }
    return false
  }
  if (existsSync(dir)) {
    throw new Error(`${dir} already exists and is not a registered worktree`)
  }
  await createWorktree(root, config, branch, dir, from)
  return true
}

async function launchClaude(root: string, branch: string, dir: string): Promise<number> {
  try {
    const proc = Bun.spawn(['claude', '--remote-control', sessionName(root, branch)], {
      cwd: dir,
      stdio: ['inherit', 'inherit', 'inherit'],
    })
    return await proc.exited
  } catch (err) {
    throw new Error(`Cannot start claude (${(err as Error).message}), use --no-claude to skip`)
  }
}

export async function openWorktree(cwd: string, branch: string, options: OpenOptions): Promise<number> {
  const root = await repoRoot(cwd)
  const { config } = await loadConfig(root)
  await assertBranchName(branch, root)
  const dir = worktreePath(root, config, branch)

  if (await ensureWorktree(root, config, branch, dir, options.from)) {
    try {
      await runTasks(config.initialize, { root, path: dir, branch })
    } catch (err) {
      throw new Error(`${(err as Error).message}, worktree kept at ${dir}`)
    }
  }

  if (!options.claude) {
    console.log(dir)
    return 0
  }
  return launchClaude(root, branch, dir)
}

export const openCommand = defineCommand(
  'open',
  { description: 'Create or open a worktree and start claude in it', aliases: ['create'] },
  (cmd) =>
    cmd
      .args({ name: 'branch', type: 'string', description: 'Branch name', required: true })
      .flags({
        from: { type: 'string', description: 'Base ref for new branches (default: config base)' },
        claude: { type: 'boolean', default: true, description: 'Start claude with remote control (--no-claude to skip)' },
      })
      .action(async ({ args, flags }) => {
        process.exitCode = await openWorktree(process.cwd(), args.branch, { from: flags.from, claude: flags.claude })
      }),
)
