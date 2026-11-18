#!/usr/bin/env bun
import { Crust } from '@crustjs/core'
import { didYouMean, help, version } from '@crustjs/extensions'
import pkg from '../package.json' with { type: 'json' }
import { initCommand } from './commands/init.ts'

await new Crust('work3', { description: pkg.description })
  .extend(help())
  .extend(version((pkg as any).version))
  .extend(didYouMean())
  .add(initCommand)
  .execute()
