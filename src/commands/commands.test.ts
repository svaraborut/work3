import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { branchExists, git } from '../git.ts'
import { initRepo } from './init.ts'
import { managedWorktrees } from './list.ts'
import { openWorktree } from './open.ts'
import { removeWorktree } from './remove.ts'

let root: string
const spies: { mockRestore(): void }[] = []

async function commitAll(message: string): Promise<void> {
  await git(['add', '-A'], root)
  await git(['-c', 'user.name=work3', '-c', 'user.email=work3@example.com', 'commit', '-q', '-m', message], root)
}

beforeEach(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'work3-repo-')))
  await git(['init', '-q', '-b', 'main'], root)
  await git(['-c', 'user.name=work3', '-c', 'user.email=work3@example.com', 'commit', '-q', '--allow-empty', '-m', 'init'], root)
  spies.push(spyOn(console, 'log').mockImplementation(() => {}), spyOn(console, 'warn').mockImplementation(() => {}))
})

afterEach(() => {
  spies.splice(0).forEach((spy) => spy.mockRestore())
  rmSync(root, { recursive: true, force: true })
})

describe('worktree lifecycle', () => {
  test('init, open, list, remove', async () => {
    await initRepo(root, false)
    const config = JSON.parse(readFileSync(join(root, 'worktree.json'), 'utf8'))
    config.initialize = [{ name: 'mark', cmd: 'echo $WORK3_BRANCH > .marker' }]
    config.destroy = [{ cmd: 'echo $WORK3_BRANCH > $WORK3_ROOT/destroyed.txt' }]
    writeFileSync(join(root, 'worktree.json'), JSON.stringify(config))
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('/worktrees/')
    await commitAll('config')

    const dir = join(root, 'worktrees', 'feat--a')
    expect(await openWorktree(root, 'feat/a', { claude: false })).toBe(0)
    expect(readFileSync(join(dir, '.marker'), 'utf8').trim()).toBe('feat/a')

    const { worktrees } = await managedWorktrees(dir)
    expect(worktrees.map((wt) => [wt.branch, wt.status])).toEqual([['feat/a', 'dirty']])

    await expect(removeWorktree(root, 'feat/a', { force: false, deleteBranch: false })).rejects.toThrow(/--force/)
    expect(existsSync(join(root, 'destroyed.txt'))).toBe(false)

    await removeWorktree(root, 'feat/a', { force: true, deleteBranch: true })
    expect(existsSync(dir)).toBe(false)
    expect(readFileSync(join(root, 'destroyed.txt'), 'utf8').trim()).toBe('feat/a')
    expect(await branchExists('feat/a', root)).toBe(false)
  })

  test('failing initialize keeps the worktree', async () => {
    writeFileSync(join(root, 'worktree.json'), JSON.stringify({ initialize: [{ name: 'boom', cmd: 'exit 2' }] }))
    await commitAll('config')
    await expect(openWorktree(root, 'broken', { claude: false })).rejects.toThrow(/boom.*worktree kept/)
    expect(existsSync(join(root, 'worktrees', 'broken'))).toBe(true)
  })

  test('reopen skips initialize', async () => {
    writeFileSync(join(root, 'worktree.json'), JSON.stringify({ initialize: [{ cmd: 'echo x >> count.txt' }] }))
    await commitAll('config')
    await openWorktree(root, 'again', { claude: false })
    await openWorktree(root, 'again', { claude: false })
    expect(readFileSync(join(root, 'worktrees', 'again', 'count.txt'), 'utf8').trim()).toBe('x')
  })
})
