import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { parseWorktreeList } from './git.ts'
import { isInside, safeName } from './worktree.ts'

describe('safeName', () => {
  test('maps separators to double dash', () => {
    expect(safeName('feat/a')).toBe('feat--a')
    expect(safeName('feat\\a/b')).toBe('feat--a--b')
    expect(safeName('feat-a')).toBe('feat-a')
  })
})

describe('isInside', () => {
  test('detects nested paths', () => {
    expect(isInside(resolve('/r/worktrees/a/src'), resolve('/r/worktrees/a'))).toBe(true)
    expect(isInside(resolve('/r/worktrees/a'), resolve('/r/worktrees/a'))).toBe(true)
    expect(isInside(resolve('/r/worktrees/ab'), resolve('/r/worktrees/a'))).toBe(false)
  })
})

describe('parseWorktreeList', () => {
  test('parses porcelain output', () => {
    const out = 'worktree /r\nHEAD abc\nbranch refs/heads/main\n\nworktree /r/worktrees/feat--a\nHEAD def\nbranch refs/heads/feat/a\n\nworktree /r/worktrees/x\nHEAD 123\ndetached\n'
    const entries = parseWorktreeList(out)
    expect(entries.map((e) => e.branch)).toEqual(['main', 'feat/a', undefined])
    expect(entries[2]?.detached).toBe(true)
    expect(entries[1]?.path).toBe(resolve('/r/worktrees/feat--a'))
  })
})
