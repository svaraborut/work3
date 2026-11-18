import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const CONFIG_FILES = ['worktree.json', 'worktree.yaml', 'worktree.yml'] as const

export const TaskSchema = z.strictObject({
  name: z.string().optional(),
  cmd: z.string().min(1),
})

export const ConfigSchema = z.strictObject({
  location: z.string().min(1).default('worktrees'),
  base: z.string().min(1).default('main'),
  initialize: z.array(TaskSchema).default([]),
  destroy: z.array(TaskSchema).default([]),
})

export type Task = z.infer<typeof TaskSchema>
export type Config = z.infer<typeof ConfigSchema>

export interface LoadedConfig {
  config: Config
  file: string
  ignored: string[]
}

export function findConfigFiles(root: string): string[] {
  return CONFIG_FILES.map((name) => join(root, name)).filter((file) => existsSync(file))
}

export async function parseConfigFile(file: string): Promise<Config> {
  const text = await Bun.file(file).text()
  let raw: unknown
  try {
    raw = file.endsWith('.json') ? JSON.parse(text) : Bun.YAML.parse(text)
  } catch (err) {
    throw new Error(`Cannot parse ${file}: ${(err as Error).message}`)
  }
  const result = ConfigSchema.safeParse(raw ?? {})
  if (!result.success) {
    throw new Error(`Invalid config ${file}:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export async function loadConfig(root: string): Promise<LoadedConfig> {
  const [file, ...ignored] = findConfigFiles(root)
  if (!file) {
    throw new Error(`No worktree config found in ${root}, run "work3 init" first`)
  }
  if (ignored.length) {
    console.warn(`warning: using ${file}, ignoring ${ignored.join(', ')}`)
  }
  return { config: await parseConfigFile(file), file, ignored }
}
