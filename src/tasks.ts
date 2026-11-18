import { $ } from 'bun'
import type { Task } from './config.ts'

export interface TaskContext {
  root: string
  path: string
  branch: string
}

export interface RunTasksOptions {
  continueOnError?: boolean
}

export function taskLabel(task: Task): string {
  return task.name ?? task.cmd
}

export async function runTasks(tasks: Task[], ctx: TaskContext, options: RunTasksOptions = {}): Promise<void> {
  const env = { ...process.env, WORK3_ROOT: ctx.root, WORK3_PATH: ctx.path, WORK3_BRANCH: ctx.branch }
  for (const task of tasks) {
    console.log(`> ${taskLabel(task)}`)
    const { exitCode } = await $`${{ raw: task.cmd }}`.cwd(ctx.path).env(env).nothrow()
    if (exitCode === 0) continue
    const message = `Task "${taskLabel(task)}" failed with exit code ${exitCode}`
    if (!options.continueOnError) throw new Error(message)
    console.warn(`warning: ${message}, continuing`)
  }
}
