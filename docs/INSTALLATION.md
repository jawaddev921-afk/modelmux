# Installation

ModelMux can be run as a standalone binary or from source using Bun.

## Prerequisites

- **Bun 1.4.4+**: ModelMux is built with [Bun](https://bun.sh/). If you are running from source or building binaries, you will need Bun 1.4.4 or newer installed (`mise install` installs the pinned 1.4.4).

## Standalone Binary

ModelMux can be compiled into a single, self-contained binary that includes the Bun runtime, all backend logic, the pre-built frontend dashboard, and the database migration files.

### Build Commands

1. **Clone the repository**:

   ```bash
   git clone https://github.com/jawaddev921-afk/modelmux.git
   cd modelmux
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Compile**:
   - **macOS (ARM64/Apple Silicon):** `bun run compile:macos`
   - **Linux (x64):** `bun run compile:linux-amd64`
   - **Linux (ARM64):** `bun run compile:linux-arm64`
   - **Windows (x64):** `bun run compile:windows`

The resulting executable will be named `modelmux-macos`, `modelmux-linux-amd64`,
`modelmux-linux-arm64`, or `modelmux.exe` in the project root.

The binary is fully self-contained: migration SQL files are embedded inside it at compile time, so no separate `drizzle/` directory or `DRIZZLE_MIGRATIONS_PATH` environment variable is needed when running the standalone binary.

### Running the Windows Standalone Binary

If `modelmux.exe` opens and closes immediately, run it from a terminal so startup errors remain visible. `ADMIN_KEY` must be set before starting the server.

**Windows PowerShell:**

```powershell
$env:ADMIN_KEY = "your-admin-password"
$env:DATABASE_URL = "sqlite://./data/modelmux.db"
.\modelmux.exe
```

**Windows Command Prompt:**

```cmd
set ADMIN_KEY=your-admin-password
set DATABASE_URL=sqlite://./data/modelmux.db
modelmux.exe
```

## Running from Source

1. **Clone the repository**:

   ```bash
   git clone https://github.com/jawaddev921-afk/modelmux.git
   cd modelmux
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Start Development Stack**:

   ```bash
   ADMIN_KEY="your-admin-key" DATABASE_URL=sqlite://./data/modelmux.db bun run dev
   ```

   If mise is not activated in your shell, use `mise exec -- bun run dev`.
   Run `mise install` once to install the project-managed tools. FRP is
   optional; without `frpc` on `PATH`, or without `FRPC_SERVER_ADDR` and
   `FRPC_AUTH_TOKEN`, the dev server runs without a tunnel. The tunnel is
   stopped with the dev process.

   To run the background lifecycle instead:

   ```bash
   bun run dev:agent --detach
   bun run dev:stop
   ```

   Prefix these commands with `mise exec --` when mise is not activated.

## Environment Variables

When running ModelMux, you can use the following environment variables to control its behavior:

- **`ADMIN_KEY`** (**Required**): Password for the admin dashboard and management API.
  - Must be set before starting the server. Server will refuse to start without it.
- **`DATABASE_URL`** (Optional): Database connection string (defaults to SQLite at `./data/modelmux.db`).
  - SQLite: `sqlite:///app/data/modelmux.db` or `sqlite://./data/modelmux.db`
  - PostgreSQL: `postgres://user:password@host:5432/dbname`
- **`ENCRYPTION_KEY`** (Optional): Encryption key for sensitive data at rest (API keys, OAuth tokens, provider credentials).
  - Generate with: `openssl rand -hex 32`
  - If not set, data is stored in plaintext. A warning is logged at startup.
  - See [Configuration: Encryption at Rest](CONFIGURATION.md#encryption-at-rest-optional) for details.
- **`LOG_LEVEL`**: The verbosity of the server logs.
  - Supported values: `error`, `warn`, `info`, `debug`, `silly`.
  - Default: `info`.
  - Note: `silly` logs all request/response/transformations.
  - Runtime override: You can change log level live via the management API/UI (`/v0/management/logging/level`). This override is ephemeral and resets on restart.
- **`PORT`** (Optional): HTTP server port. Default: `4000` (Note: When running `bun run dev` locally, the port is automatically derived from the git worktree directory name).
- **`HOST`** (Optional): Address to bind to. Default: `0.0.0.0`
- **`DATA_DIR`** (Optional): Directory for SQLite database. Default: `./data`
- **`FRPC_SERVER_ADDR`** (Development only): LAN-reachable address of the frps server.
- **`FRPC_AUTH_TOKEN`** (Development only): Token shared with frps.
- **`FRPC_SERVER_PORT`** (Development only): frps control port. Default: `7000`.
- **`FRPC_SUBDOMAIN_HOST`** (Development only): Optional suffix used only to print the full HTTPS URL. The frps `subDomainHost` setting controls routing.

### Example Usage

```bash
ADMIN_KEY="your-secret" DATABASE_URL=sqlite://./data/modelmux.db LOG_LEVEL=debug ./modelmux
```

---

For configuration details, please refer to the [Configuration Guide](CONFIGURATION.md).
