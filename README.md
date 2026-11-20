<div align="center">

# Work3 CLI

**Run a fleet of Claude Code agents in parallel, each on its own branch, in its own fully set up worktree.**

[![GitHub stars](https://img.shields.io/github/stars/svaraborut/work3?style=for-the-badge&logo=github&logoColor=white&label=stars&labelColor=18181b&color=3f3f46)](https://github.com/svaraborut/work3/stargazers)
[![Claude Code](https://img.shields.io/badge/remote%20control-d97757?style=for-the-badge&logo=claude&logoColor=white&label=claude%20code&labelColor=18181b)](https://claude.com/claude-code)
[![npm](https://img.shields.io/npm/v/@svara/work3?style=for-the-badge&logo=npm&logoColor=white&label=npm&labelColor=18181b&color=cb3837)](https://www.npmjs.com/package/@svara/work3)
[![License: MIT](https://img.shields.io/github/license/svaraborut/work3?style=for-the-badge&label=license&labelColor=18181b&color=3f3f46)](https://github.com/svaraborut/work3/blob/main/LICENSE)

<picture>
  <source srcset="https://raw.githubusercontent.com/svaraborut/work3/main/docs/animation.gif" type="image/gif">
  <img src="https://raw.githubusercontent.com/svaraborut/work3/main/docs/hero.png" alt="Six Claude Code sessions running side by side, each in its own work3 worktree" width="100%">
</picture>

</div>

Parallel agents need separate checkouts. `git worktree` gives you one, but each new worktree still needs dependencies installed, `.env` files copied, a folder name and, later, a cleanup. work3 does all of that in one command, from a config you commit once and share with your team.

**The old way**

```shell
git worktree add -b feat/login worktrees/feat--login main
cd worktrees/feat--login
bun ci
cp ../../.env .env
claude --remote-control my-app/feat/login
cd ../..
git merge --ff-only feat/login
git worktree remove worktrees/feat--login
git branch -d feat/login
```

**🚀 With work3**

```shell
work3 open feat/login
work3 fold feat/login -rd
```

## Features

- 🚀 **One command per branch** - worktree, setup and Claude Code in one go
- 📦 **Shared setup** - install and cleanup tasks committed with the repo
- 📱 **Remote Control** - steer every agent from your phone
- 🔀 **Linear history** - finished branches land fast-forward only
- 🛡️ **Safe teardown** - uncommitted work is never deleted
- 🖥️ **Cross-platform** - same tasks on Windows, macOS and Linux
- 🧭 **No hidden state** - git is the only source of truth

## Install

Requires [Bun](https://bun.sh) 1.2.21 or newer, git, and [Claude Code](https://claude.com/claude-code) on your `PATH`.

```shell
bun add -g @svara/work3
work3 --help
```

## Quick start

```shell
cd my-project
work3 init                   # writes worktree.json and ignores /worktrees/
work3 open feat/login        # create, set up and start claude
work3 ls                     # see all worktrees and their status
work3 fold feat/login -rd    # fast-forward main, remove worktree and branch
work3 rm feat/login -d       # or discard: run destroy tasks, remove worktree and branch
```

## Commands

### `work3 init`

Sets up a repository for work3 in one step. It writes a `worktree.json` with sensible defaults that you commit and share with your team, and it never overwrites a config that already exists.

- `--yaml` - write `worktree.yaml` instead

### `work3 open <branch>`

Takes you from a branch name to a running agent in a fully set up workspace. A new branch gets its own worktree, your setup tasks and a Claude Code session you can steer from your phone. A branch you have worked on before reopens exactly where you left it, with no setup to wait for.

- `--from <ref>` - start a new branch from another ref, for example `origin/main`
- `--no-claude` - set up the worktree without starting Claude and print its path

### `work3 list`

Shows every agent workspace at a glance: its branch, its folder, and whether it is `clean`, `dirty` with work not yet committed, or `missing` because its folder was deleted.

### `work3 remove <branch>`

Throws away a worktree you no longer need and runs your cleanup tasks. The branch is kept, so the commits stay available.

> [!TIP]
> Uncommitted work is never lost by accident: a worktree with changes is refused before anything is touched.

- `-d, --delete-branch` - delete the branch too
- `-f, --force` - discard uncommitted changes and push through failing cleanup tasks

### `work3 fold <branch>`

Lands a finished branch on `main` with a clean, linear history: fast-forward only, never a merge commit, rebase or push. The files in your main checkout move forward too, ready to test or push.

> [!TIP] 
> A branch with uncommitted work, or one that has fallen behind `main`, is refused with a hint to rebase it first. If cleanup fails after folding, your commits are still landed and `work3 rm <branch>` finishes the job.

- `--into <ref>` - land on another branch instead of `base`
- `-r, --remove` - remove the worktree once landed
- `-d, --delete-branch` - with `-r`, delete the branch too
- `-f, --force` - with `-r`, push through failing cleanup tasks

## Configuration

work3 reads its config from the root of the main checkout, looking for `worktree.json`, `worktree.yaml` or `worktree.yml`. If more than one exists, work3 warns and uses the first. Commit the config so the whole team shares the same augmented workflow.

```json
{
  "location": "worktrees",
  "base": "main",
  "initialize": [
    { "name": "install", "cmd": "bun ci" },
    { "name": "env", "cmd": "cp $WORK3_ROOT/.env .env" }
  ],
  "destroy": [
    { "name": "cleanup", "cmd": "echo removing $WORK3_BRANCH" }
  ]
}
```

| Key | Type | Default | Description |
|---|---|---|---|
| `location` | string | `"worktrees"` | Folder for worktrees, relative to the repository root |
| `base` | string | `"main"` | Ref new branches start from, overridable with `--from` |
| `initialize` | task[] | `[]` | Tasks run once, right after a worktree is created |
| `destroy` | task[] | `[]` | Tasks run before a worktree is removed |

Each task is `{ "name"?: string, "cmd": string }`. `name` is shown in the output, `cmd` is shown when `name` is missing.

### Tasks

Tasks run one after another, inside the worktree folder, through [Bun Shell](https://bun.sh/docs/runtime/shell). Built-ins such as `cp`, `rm`, `mkdir` and `echo` behave the same on every OS. These environment variables are available in addition to your own:

| Variable | Value |
|---|---|
| `WORK3_ROOT` | Path of the main checkout |
| `WORK3_PATH` | Path of the worktree |
| `WORK3_BRANCH` | Branch name |

## Contributing

```shell
git clone https://github.com/svaraborut/work3.git && cd work3
bun install
bun run build && bun link   # puts your local build on PATH as work3
bun run dev -- --help       # run from source without building
bun test
bun run typecheck
```

Releases are automatic and follow [Conventional Commits](https://www.conventionalcommits.org): `!` or `BREAKING CHANGE:` bumps the major, anything else the minor. Pushing to `main` tags `vX.Y.Z`, publishes to npm as `latest` and creates a GitHub release with the changelog, pushing to `stage` publishes a `X.Y.Z-rcN` release candidate under the `rc` tag (`bun add -g @svara/work3@rc`).

## License

[MIT](LICENSE) © Borut Svara
