# ModelMux CLI

`@jawaddev921-afk/modelmux-cli` is a Bun-powered command-line client for the ModelMux
management API. It discovers the target server's OpenAPI document at runtime,
so documented management operations are available without a CLI update.

## Install or run

Run once with Bun:

```bash
bunx @jawaddev921-afk/modelmux-cli api list
```

Or install the `modelmuxcli` command globally:

```bash
bun install -g @jawaddev921-afk/modelmux-cli
modelmuxcli --help
```

## Connect to ModelMux

Set the target URL and management key. The local ModelMux dev stack defaults to
`password`; use a real admin key for non-local instances.

```bash
export MODELMUX_URL="http://localhost:<PORT>"
export MODELMUX_ADMIN_KEY=password

modelmuxcli api call getV0ManagementAuthVerify
modelmuxcli api list
```

Use `--url` and `--admin-key` to override the environment for one invocation.
