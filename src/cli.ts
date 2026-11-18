#!/usr/bin/env bun
import { Crust } from '@crustjs/core'
import { didYouMean, help, version } from '@crustjs/extensions'
import pkg from '../package.json' with { type: 'json' }
import { foldCommand } from './commands/fold.ts'
import { initCommand } from './commands/init.ts'
import { listCommand } from './commands/list.ts'
import { openCommand } from './commands/open.ts'
import { removeCommand } from './commands/remove.ts'

await new Crust('work3', { description: pkg.description })
  .extend(help())
  .extend(version((pkg as any).version))
  .extend(didYouMean())
  .add(initCommand, openCommand, listCommand, removeCommand, foldCommand)
  .execute()
