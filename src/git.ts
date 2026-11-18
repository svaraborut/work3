import { resolve } from 'node:path'

export interface GitResult {
  code: number
  stdout: string
  stderr: string
}

export interface WorktreeEntry {
  path: string
  head?: string
  branch?: string
  bare: boolean
  detached: boolean
}

export async function gitRaw(args: string[], cwd: string): Promise<GitResult> {
  const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, stdout: stdout.trim(), stderr: stderr.trim() }
}

export async function git(args: string[], cwd: string): Promise<string> {
  const result = await gitRaw(args, cwd)
  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

// Interactive variant so git can print progress and prompt directly in the terminal.
export async function gitInherit(args: string[], cwd: string): Promise<void> {
  const code = await Bun.spawn(['git', ...args], { cwd, stdio: ['inherit', 'inherit', 'inherit'] }).exited
  if (code !== 0) {
    throw new Error(`git ${args.join(' ')} failed with exit code ${code}`)
  }
}

export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = []
  for (const block of porcelain.split(/\r?\n\r?\n/)) {
    const entry: WorktreeEntry = { path: '', bare: false, detached: false }
    for (const line of block.split(/\r?\n/)) {
      const [key, ...rest] = line.split(' ')
      const value = rest.join(' ')
      if (key === 'worktree') entry.path = resolve(value)
      else if (key === 'HEAD') entry.head = value
      else if (key === 'branch') entry.branch = value.replace(/^refs\/heads\//, '')
      else if (key === 'bare') entry.bare = true
      else if (key === 'detached') entry.detached = true
    }
    if (entry.path) entries.push(entry)
  }
  return entries
}

export async function listWorktrees(cwd: string): Promise<WorktreeEntry[]> {
  return parseWorktreeList(await git(['worktree', 'list', '--porcelain'], cwd))
}

// The first entry of `git worktree list` is always the main checkout, also from inside linked worktrees and submodules.
export async function repoRoot(cwd: string = process.cwd()): Promise<string> {
  const check = await gitRaw(['rev-parse', '--is-inside-work-tree'], cwd)
  if (check.code !== 0 || check.stdout !== 'true') {
    throw new Error(`Not inside a git repository: ${cwd}`)
  }
  const [main] = await listWorktrees(cwd)
  if (!main || main.bare) {
    throw new Error('Bare repositories are not supported')
  }
  return main.path
}

export async function branchExists(branch: string, cwd: string): Promise<boolean> {
  return (await gitRaw(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], cwd)).code === 0
}

export async function refExists(ref: string, cwd: string): Promise<boolean> {
  return (await gitRaw(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd)).code === 0
}

export async function currentBranch(cwd: string): Promise<string> {
  return (await gitRaw(['branch', '--show-current'], cwd)).stdout
}

export async function isIgnored(path: string, cwd: string): Promise<boolean> {
  return (await gitRaw(['check-ignore', '-q', '--', path], cwd)).code === 0
}

export async function isDirty(cwd: string): Promise<boolean> {
  return (await git(['status', '--porcelain'], cwd)) !== ''
}
