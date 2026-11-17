#!/usr/bin/env bun
import { Crust } from '@crustjs/core'
import { didYouMean, help, version } from '@crustjs/extensions'
import pkg from '../package.json' with { type: 'json' }

await new Crust('work3')
  .extend(help())
  .extend(version((pkg as any).version))
  .extend(didYouMean())
  .args(
    {
      name: 'name',
      type: 'string',
      description: 'Your name',
      required: true,
    }
  )
  .action(async ({ args }) => {
    console.log(`Hello ${args.name} 👋🏼`)
  })
  .execute()
