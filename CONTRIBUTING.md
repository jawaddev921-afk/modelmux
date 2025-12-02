# Contributing to ModelMux

## Getting Started

```bash
git clone https://github.com/<owner>/modelmux.git
cd modelmux
bun install
```

Running `bun install` automatically installs git hooks via [Lefthook](https://github.com/evilmartians/lefthook) (the `prepare` script runs `lefthook install`). No extra setup is needed.

## Database Schema Changes

ModelMux uses Drizzle ORM with dual-dialect support (SQLite and PostgreSQL). Schema definitions live in:

- `packages/backend/drizzle/schema/sqlite/` -- SQLite table definitions
- `packages/backend/drizzle/schema/postgres/` -- PostgreSQL table definitions

### How to make schema changes

1. Edit the schema `.ts` files in the appropriate dialect directories
2. If adding a **new table**, update the index exports in `packages/backend/drizzle/schema/index.ts`
3. Generate the migration SQL with `bun run generate-migrations` from `packages/backend/`. The name is auto-derived from your branch; you can also pass `--name <descriptive-name>`.
4. Commit the schema `.ts` files together with the generated migration artifacts (`.sql` files, `meta/_journal.json` and snapshot files).

### Skipping hooks

The hooks are skipped automatically when `CI=true`. To skip locally in exceptional circumstances:

```bash
LEFTHOOK=0 git commit -m "..."
```

## Drizzle Config Files

The project uses separate Drizzle ORM config files for each database dialect:

- `drizzle.config.sqlite.ts` -- SQLite configuration
- `drizzle.config.postgres.ts` -- PostgreSQL configuration

When running Drizzle Kit commands, specify the appropriate config file with `--config`.

## Code Style

All code must be formatted with `bun fmt` (Bun 1.4.4+) before committing. Configuration, including `ignorePatterns` for generated and vendored paths, lives in the `[fmt]` section of `bunfig.toml`.

```bash
bun run format          # format everything
bun run format:check    # verify without writing
bun run format:changed  # format only files changed vs. the default branch
```

The pre-commit hook runs `bun fmt --staged`, which formats just the staged files and re-stages them, so you normally don't need to run the formatter by hand.

## Running Tests

From the repo root:

```bash
bun test                    # whole suite, one process
bun test --changed=HEAD     # only tests affected by uncommitted changes
bun test --parallel         # spread files across cores (what CI and the pre-commit hook use)
```

Run plain `bun test` before pushing: it shares one process across all files, so it catches mock and global leaks that `--parallel` hides. Before writing or changing a test, read [docs/TESTING.md](docs/TESTING.md) — it covers how to mock, fake timers and `fetch`, and which patterns leak between files.

The pre-commit hook runs the affected tests automatically (`bun test --parallel --changed=HEAD`).

## Development

### Starting the dev server

```bash
bun run dev
```

This starts the backend (with file watching) and the frontend builder in parallel.

If you use mise but do not have it activated in your shell, run the same command
through mise:

```bash
mise exec -- bun run dev
```

The port is derived automatically from the worktree directory name, so two
worktrees can run simultaneously without collision. The port and database are
printed at startup:

```
Starting ModelMux Dev Stack...
  PORT:         14641
  DATABASE_URL: sqlite:///tmp/modelmux-browsertesting.db
  ADMIN_KEY:    password
```

Override any of these with environment variables:

```bash
PORT=4000 ADMIN_KEY=mysecret bun run dev
```

#### Optional FRP tunnel

When `frpc` is available on `PATH` and both `FRPC_SERVER_ADDR` and
`FRPC_AUTH_TOKEN` are set, the dev server starts an HTTP FRP tunnel after the
local health check passes. The generated subdomain is based on the repository
and worktree names, so each worktree gets its own stable route. The tunnel stops
with the dev server.

FRP is optional. If `frpc` is not installed, or the required variables are not
set, the dev server runs normally without a tunnel. The project `mise.toml`
declares `frpc` for mise users; run `mise install` once if it is not installed.
Users who do not use mise can install `frpc` separately and put it on `PATH`.

```bash
export FRPC_SERVER_ADDR=your-frps-host
export FRPC_AUTH_TOKEN=your-frps-token
export FRPC_SUBDOMAIN_HOST=dev.example.com  # optional, display only

mise exec -- bun run dev
```

`FRPC_SERVER_PORT` is optional and defaults to `7000`. `FRPC_SUBDOMAIN_HOST`
is only used to print the full HTTPS URL; frps remains responsible for the
actual subdomain suffix through its `subDomainHost` setting.

To get the current worktree's FRP URL without scraping startup logs, run:

```bash
bun run dev:get:frp-url
```

Use `bun run dev:get:frp-url -- --hostname`, `--subdomain`, or `--json` for a hostname, subdomain, or machine-readable result. Use `--file` to print the path of the temporary URL file written while the tunnel is running. The command derives the same deterministic endpoint as the dev lifecycle; it does not check whether the tunnel is reachable.

#### Background dev stack

For a background dev stack, use the lifecycle commands:

```bash
bun run dev:agent --detach
bun run dev:stop
```

`bun run dev:agent` starts or attaches to a workspace script target, defaulting to `dev:full`, with automatic log streaming. Use `--detach` to return once the stack is healthy and leave it running in the background. Select a target with `bun run dev:agent [target]`, for example `bun run dev:agent dev:pglite --detach`; stop it with `bun run dev:stop [target]`.

Prefix these commands with `mise exec --` when mise is not activated.

`dev:stop` stops the dev process and its FRP child. `clear-dev` only resets the
local data and restarts the backend; it does not replace `dev:stop`.

#### PGlite mode (no external database required)

To run against an in-process PGlite database instead of SQLite — useful when
testing Postgres-specific behaviour without running a real server:

```bash
bun run dev:pglite
```

The startup output shows the data directory instead of a database URL:

```
Starting ModelMux Dev Stack...
  PORT:         14641
  DB Driver:    PGlite
  DB Data Dir:  /tmp/modelmux-browsertesting.pglite
  ADMIN_KEY:    password
```

The data directory persists across restarts (same worktree isolation as SQLite).
Override it with `MODELMUX_PGLITE_DATA_DIR=/path/to/dir bun run dev:pglite`.

### Seeding baseline data

After starting the dev server, seed it with a realistic baseline configuration
(providers, model aliases, quota definitions, and API keys) that exercises the
full feature set without requiring any real external credentials:

```bash
bun run populate-dev
```

This is idempotent — safe to re-run at any time. It uses `PUT` throughout, so
existing resources are replaced rather than duplicated.

#### What gets seeded

| Category      | Count | Notes                                                                                                                            |
| ------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| Providers     | 11    | Frontier cloud providers (Kilocode, Wisgate, Neuralwatt, OpenRouter, Google, OpenAI, Anthropic, CC, CC-Sigma, OpenLimits, Ozore) |
| Quotas        | 2     | Daily, weekly budgets and limits                                                                                                 |
| Model aliases | 19    | Frontier model architectures (gpt-5.x, claude-4.5/5, gemini-3.5, deepseek-v4) for chat, embeddings, speech, transcriptions       |
| API keys      | 4     | Default, OWUI, GithubKey, GHAKey                                                                                                 |

All provider URLs are mapped to their real production API gateways, but with safe, redacted mock keys by default. No real secrets are checked into the codebase.

#### Adding your own data

Create `scripts/user-populate.json` (git-ignored — see `scripts/user-populate.example.json`
for the format). Anything in that file is merged over the defaults when you run
`bun run populate-dev`, so you can add real provider keys or personal aliases
without touching committed files and without risk of accidentally leaking secrets.

#### Environment variables

| Variable           | Default            | Purpose                                    |
| ------------------ | ------------------ | ------------------------------------------ |
| `MODELMUX_URL`       | `http://localhost` | Base URL of the target instance            |
| `MODELMUX_PORT`      | derived from cwd   | Port (matches `bun run dev` automatically) |
| `MODELMUX_ADMIN_KEY` | `password`         | Admin key                                  |

### Resetting to a clean state

To wipe the database and restart the backend in one step:

```bash
bun run clear-dev
```

This deletes the SQLite file from `/tmp` and sends `SIGHUP` to the running dev
server, which gracefully shuts down the backend and immediately relaunches it
against the empty database. The frontend is unaffected. The whole cycle takes
about two seconds.

After clearing, re-run `bun run populate-dev` to restore the baseline config.

> **Note:** `clear-dev` relies on a PID file written by `bun run dev` to
> `/tmp/modelmux-<worktree>.pid`. If the server is not running, it will delete
> the database file and exit cleanly without error.
