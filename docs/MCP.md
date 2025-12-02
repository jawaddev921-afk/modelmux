# MCP Server

ModelMux exposes two MCP (Model Context Protocol) server endpoints:

1. **MCP Gateway** at `/mcp/:name` — proxies requests to configured upstream MCP servers.
2. **ModelMux Management MCP** at `/mcp/modelmux` — an admin-only MCP server for managing ModelMux itself.

Both endpoints have independent controls. The ModelMux Management MCP at `/mcp/modelmux` can be disabled via the toggle on the MCP Servers page. When disabled, `/mcp/modelmux` responds with HTTP 418; gateway servers (`/mcp/:name`) are unaffected.

## Authentication

### MCP Gateway (`/mcp/:name`)

The MCP Gateway requires an inference API key passed as a Bearer token or in the `x-api-key` header. Requests are authenticated against the same key store used by the ModelMux inference API.

- Missing key → 401
- Invalid key → 401
- Valid key with route access → proxied to the upstream MCP server

### ModelMux Management MCP (`/mcp/modelmux`)

The management MCP requires the admin key. Send it in either location:

- `x-admin-key: <ADMIN_KEY>`
- `Authorization: Bearer <ADMIN_KEY>`

Only the server's `ADMIN_KEY` is accepted. An inference API key is rejected with 403, and an MCP OAuth access token carries no management access. A non-empty `x-admin-key` header takes precedence over the bearer token.

- Missing credential → 401
- Wrong credential, or an OAuth access token → 401
- Inference API key → 403
- Valid admin key → request processed

## MCP Gateway Commands

The gateway proxies all MCP protocol messages (JSON-RPC over HTTP POST, GET, DELETE) to the configured upstream server. It does not interpret or modify tool calls. Logs are recorded in the MCP usage storage and viewable in the MCP Logs page.

### Configuring Upstream Servers

Upstream MCP servers are configured on the MCP page. Each server requires:

- **Name** — slug-safe identifier used in the URL path
- **Upstream URL** — the upstream MCP server endpoint
- **Headers** — optional headers forwarded to the upstream server
- **Timeout** — request timeout in milliseconds

ModelMux also supports **Local HTTP** MCP servers. For these, ModelMux starts a
local process with either `bunx` or `uvx`, waits for it to listen on a local
HTTP port, then proxies `/mcp/:name` to `http://127.0.0.1:<port><path>`.
Admins select the launcher (`bunx` or `uvx`), provide a package name, package
arguments, environment variables, port, and path. Arbitrary commands are not supported.

Each local server receives a stable, server-specific directory through the
`MCP_DATA_DIR` environment variable. ModelMux creates the directory before
starting the process with owner-only (`0700`) permissions. Its location is
`$MCP_SERVERS_DATA_DIR/<opaque-server-id>`; when that variable is unset, the
root defaults to `$DATA_DIR/mcp-servers` (or `/app/data/mcp-servers` if
`DATA_DIR` is unset). The environment variable is managed by ModelMux and cannot
be overridden in the server's configured environment. The directory contents
survive process and ModelMux restarts as long as the root is on durable storage.
The root can be overridden with `MCP_SERVERS_DATA_DIR`; an unset or empty value
uses the `$DATA_DIR/mcp-servers` default. Deleting a local MCP server also deletes its data directory; recreating a
server with the same name starts with a fresh directory.

This provides path separation and private permissions for each server's data
directory; it is not an operating-system sandbox for local MCP packages.
Processes launched by ModelMux run with ModelMux's OS identity and may access other
files that identity can read. Only run trusted local MCP packages.

Server names must match `[a-z0-9][a-z0-9-_]{1,62}`. The name `modelmux` is reserved for the management MCP server and cannot be used as a gateway server name.

## ModelMux Management MCP Tools

The management MCP server at `/mcp/modelmux` provides domain-oriented tools for inspecting and managing ModelMux configuration. Each tool uses an `operation` argument to select the action, keeping the tool surface compact.

### Input Shape

```json
{
  "operation": "list | get | ...",
  "id": "optional-resource-id",
  "category": "optional-settings-category",
  "query": {},
  "body": {},
  "destructive": "acknowledged"
}
```

### Destructive Operations

Destructive or high-impact operations (delete, restore, restart, rotate, etc.) require `"destructive": "acknowledged"`. If omitted, the tool call is rejected with a `confirmation_required` error.

### Secret Redaction

All normal responses redact sensitive fields (API keys, secrets, tokens, cookies, sessions, passwords). Secrets are replaced with `[REDACTED]`.

### Available Tools

| Tool                   | Operations                                                                                                               | Description                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modelmux_config`        | `get`, `export`, `status`                                                                                                | Inspect full ModelMux configuration or summary status.                                                                                                                                                                                                                                                  |
| `modelmux_provider`      | `list`, `get`, `put`, `create`, `update`, `delete`, `fetch_models`                                                       | Inspect and manage providers and routing configuration.                                                                                                                                                                                                                                               |
| `modelmux_pi_catalog`    | `providers`, `models`, `validate_config`                                                                                 | Read pi-ai provider/model IDs and validate configured `pi_ai_provider` / `pi_ai_model_id` references against the merged catalog. `validate_config` reports model IDs that lack a provider mapping as invalid. `models` takes the pi-ai provider ID in `id` and supports an optional `query.q` search. |
| `modelmux_model_alias`   | `list`, `get`, `put`, `create`, `update`, `delete`, `delete_all`                                                         | Inspect and manage model aliases, targets, and target groups.                                                                                                                                                                                                                                         |
| `modelmux_key`           | `list`, `get`, `put`, `create`, `update`, `delete`                                                                       | Inspect and manage inference keys (secrets redacted).                                                                                                                                                                                                                                                 |
| `modelmux_quota`         | `list`, `get`, `put`, `create`, `update`, `delete`                                                                       | Inspect and manage user quota definitions.                                                                                                                                                                                                                                                            |
| `modelmux_quota_checker` | `types`, `list`, `get`                                                                                                   | Inspect upstream quota checker configuration.                                                                                                                                                                                                                                                         |
| `modelmux_usage`         | `list`, `summary`, `delete`, `delete_all`                                                                                | Review request logs and usage summaries; delete individual or bulk usage logs.                                                                                                                                                                                                                        |
| `modelmux_debug`         | `state`, `update`, `logs`, `get_log`, `delete_log`, `delete_all_logs`                                                    | Inspect and manage in-memory debug tracing targets (`enabled`, `keys`, `aliases`, `providers`) and stored debug logs.                                                                                                                                                                                 |
| `modelmux_mcp_gateway`   | `servers_list`, `list`, `get`, `put`, `create`, `update`, `delete`                                                       | Inspect and manage upstream MCP gateway server configuration.                                                                                                                                                                                                                                         |
| `modelmux_settings`      | `get`                                                                                                                    | Get settings by category (failover, cooldown, timeout, stall, exploration, etc.)                                                                                                                                                                                                                      |
| `modelmux_system_logs`   | `recent`, `level`, `set_level`, `reset_level`                                                                            | Inspect recent in-memory ModelMux system logs from the bounded ring buffer and control the runtime logging level.                                                                                                                                                                                       |
| `modelmux_operations`    | `backup`, `restore`, `restart`, `refresh_metadata`, `refresh_catalog`, `list_cooldowns`, `clear_cooldowns`, `reset_logs` | High-impact operational actions, backups/restores, catalog refreshes, cooldown inspection, and log resets.                                                                                                                                                                                            |

### Prompt Resource

The management MCP server registers a `modelmux_management_guide` prompt that MCP clients can request. It describes ModelMux, the tool design, destructive acknowledgement, secret redaction, and recommended workflows.

## Enabling / Disabling

The ModelMux Management MCP can be toggled from the **MCP Servers** page. The "ModelMux Management MCP" row at the top of the server list provides the toggle. When disabled, only `/mcp/modelmux` responds with:

```
HTTP 418 I'm a teapot
{
  "error": {
    "message": "ModelMux Management MCP is disabled. Enable it on the MCP Servers page.",
    "type": "mcp_disabled"
  }
}
```

The default state is **enabled**.
