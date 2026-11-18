import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from './config.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'work3-config-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('loadConfig', () => {
  test('applies defaults', async () => {
    writeFileSync(join(root, 'worktree.json'), '{}')
    const { config } = await loadConfig(root)
    expect(config).toEqual({ location: 'worktrees', base: 'main', initialize: [], destroy: [] })
  })

  test('parses yaml', async () => {
    writeFileSync(join(root, 'worktree.yml'), 'base: develop\ninitialize:\n  - name: install\n    cmd: bun ci\n')
    const { config } = await loadConfig(root)
    expect(config.base).toBe('develop')
    expect(config.initialize).toEqual([{ name: 'install', cmd: 'bun ci' }])
  })

  test('treats empty yaml as defaults', async () => {
    writeFileSync(join(root, 'worktree.yaml'), '')
    const { config } = await loadConfig(root)
    expect(config.location).toBe('worktrees')
  })

  test('rejects unknown keys', async () => {
    writeFileSync(join(root, 'worktree.json'), '{"initialise": []}')
    await expect(loadConfig(root)).rejects.toThrow(/Invalid config/)
  })

  test('rejects tasks without cmd', async () => {
    writeFileSync(join(root, 'worktree.json'), '{"initialize": [{"name": "x"}]}')
    await expect(loadConfig(root)).rejects.toThrow(/Invalid config/)
  })

  test('rejects malformed json', async () => {
    writeFileSync(join(root, 'worktree.json'), '{')
    await expect(loadConfig(root)).rejects.toThrow(/Cannot parse/)
  })

  test('fails when no config exists', async () => {
    await expect(loadConfig(root)).rejects.toThrow(/work3 init/)
  })

  test('prefers json over yaml over yml and warns', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    writeFileSync(join(root, 'worktree.yml'), 'base: yml')
    writeFileSync(join(root, 'worktree.yaml'), 'base: yaml')
    expect((await loadConfig(root)).config.base).toBe('yaml')
    writeFileSync(join(root, 'worktree.json'), '{"base": "json"}')
    const loaded = await loadConfig(root)
    expect(loaded.config.base).toBe('json')
    expect(loaded.ignored).toHaveLength(2)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
