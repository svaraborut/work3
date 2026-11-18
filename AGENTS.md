# work3

CLI to create, open, list and remove git worktrees with per-repo setup tasks, optionally launching Claude Code with Remote Control inside them.

## Stack

- Runtime: Bun only (`bun link` for local install, `#!/usr/bin/env bun` shebang)
- CLI framework: `@crustjs/core` + `@crustjs/extensions` (help, version, didYouMean)
- Validation: Zod (strict schema, `z.strictObject`)
- YAML: `Bun.YAML.parse` (no extra dependency)
- Process execution: `Bun.spawn` for git and claude, Bun Shell (`Bun.$`) for tasks
- Tests: `bun test`

## Architecture

### Principles

- Git is the only source of truth: no work3 state file, worktrees are discovered via `git worktree list --porcelain`.
- Repo root is always the main checkout, resolved as the first entry of `git worktree list --porcelain` (also correct for submodules, unlike the parent of `--git-common-dir`), so every command works from inside any worktree. Bare repos are rejected.
- No implicit `git fetch`; refs are used as they exist locally.

### Config

- Lookup order in the main checkout root: `worktree.json` > `worktree.yaml` > `worktree.yml`.
- First match wins; warn listing the ignored files if more than one exists.
- Missing config: commands other than `init` fail with a hint to run `work3 init`.
- Config is meant to be committed (team-shared).
- Schema:

```ts
const Task = z.strictObject({
  name: z.string().optional(),
  cmd: z.string().min(1),
})

const Config = z.strictObject({
  location: z.string().default('worktrees'), // relative to repo root
  base: z.string().default('main'),          // base ref for new branches
  initialize: z.array(Task).default([]),     // run on create only
  destroy: z.array(Task).default([]),        // run before remove
})
```

- Future task kinds (pg, s3, domain, ...) are added as `z.union([CmdTask, PgTask, ...])` with a `type` discriminator on the new kinds only; cmd tasks stay valid without `type`.

### Naming

- Worktree dir: `<root>/<location>/<safe-name>` where safe-name replaces `/` and `\` with `--` (`feat/a` -> `feat--a`).
- If the target dir exists but is checked out on a different branch, fail.

### Commands

#### `work3 init [--yaml]`

- Fail if not inside a git repo.
- Fail if any config file already exists (no overwrite).
- Write `worktree.json` (or `worktree.yaml` with `--yaml`) with `location: "worktrees"`, `base` = `main` if it exists else the current branch, empty `initialize` and `destroy`.
- Append `location` to `.gitignore` unless already ignored (`git check-ignore`).

#### `work3 open <branch> [--from <ref>] [--no-claude]` (alias: `create`)

- Worktree exists: skip creation and tasks.
- Branch exists, no worktree: `git worktree add <dir> <branch>` (base ignored).
- Branch name is validated with `git check-ref-format --branch`.
- Target dir registered on another branch, or existing but not a worktree: fail.
- Branch exists, `--from` given: warn that it is ignored.
- Branch missing: `git worktree add -b <branch> <dir> <ref>` where ref = `--from` > config `base`.
- Missing base ref: fail with `base '<ref>' not found, set base in worktree config or pass --from`.
- After creation, run `initialize` tasks; on failure stop, keep the worktree, report the failing task, do not launch claude.
- Then `claude --remote-control <repo>/<branch>` via `Bun.spawn` with `cwd: <dir>`, `stdio: 'inherit'`; exit with claude's exit code.
- `--no-claude`: print the worktree path instead of launching.

#### `work3 list`

- Alias `ls`.
- Show worktrees under `location`: branch, status (`clean`, `dirty` via `git status --porcelain`, or `missing` when the dir is gone), path relative to root.
- todo: `--json` output for scripting

#### `work3 remove <branch> [--force] [--delete-branch]`

- Refuse when the current working directory is inside the target worktree (Windows locks it).
- Alias `rm`; short flags `-f` and `-d`.
- Dirty worktree (`git status --porcelain`, untracked included) is refused before any destroy task runs, unless `--force`, so a refused removal never leaves resources half torn down.
- Order: run `destroy` tasks -> `git worktree remove` -> optional `git branch -d`.
- Task failure stops removal unless `--force`.
- Missing worktree dir: skip destroy tasks with a warning, still deregister it.
- `--force` skips failing tasks, passes `--force` to `git worktree remove`, uses `git branch -D`.
- Branch is kept by default.

### Tasks

- Run sequentially via Bun Shell (cross-platform builtins: `cp`, `rm`, `mkdir`, `echo`, ...), raw command string.
- `cwd` is the worktree dir.
- Env: inherited env + `WORK3_ROOT` (main checkout), `WORK3_PATH` (worktree dir), `WORK3_BRANCH`.
- Log `name` (fallback `cmd`) before each task; stream output.

### Source layout

```
src/
  cli.ts              # crust wiring
  config.ts           # zod schema, lookup, load
  git.ts              # git wrappers over Bun.spawn
  tasks.ts            # bun shell task runner
  worktree.ts         # naming and path helpers
  commands/
    init.ts
    open.ts
    list.ts
    remove.ts
```

### Tests

- Config parsing, defaults, strict errors, lookup order and multi-file warning.
- Safe-name mapping.
- Integration: temp git repo, `open --no-claude` runs initialize, `remove` runs destroy and removes the worktree.

### Known limitations

- A CLI cannot change the parent shell's cwd; after claude exits the user is back in the original directory.
- Tools in the main checkout (tsc, eslint, IDE) may crawl `worktrees/`; exclude it in their configs if needed.

### Deferred

- todo: host JSON schema (`z.toJSONSchema()`) and write `$schema` from `init`
- todo: configurable launcher (`claude: { args }` or other agents)
- todo: local overrides (`worktree.local.json`)
- todo: distribution via npm or `bun build --compile`
- todo: task kinds beyond cmd (pg database, s3, domain)

## TODO

- [x] Config module (schema, lookup, load) with tests
- [x] Git wrappers and repo root resolution
- [x] `init` command
- [x] `open` / `create` command with task runner and claude launch
- [x] `list` command
- [x] `remove` command
- [x] Integration test in temp repo
- [x] Cleanup: drop `index.ts`, fix `web3` typo in README
- [ ] Task kinds: pg, s3, domain
