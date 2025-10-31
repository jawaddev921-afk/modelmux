# ModelMux

ModelMux is a self-hosted LLM gateway that gives your clients one consistent API while it routes requests across many model providers.

## What This Project Does

- Accepts OpenAI Chat Completions, Completions and Responses, Anthropic Messages, Gemini `generateContent`, embeddings, image, speech and transcription requests.
- Translates each request into the API format the chosen provider speaks.
- Maps model aliases to provider targets with target groups, sticky sessions and `random`, `in_order`, `cost`, `performance`, `latency`, `usage` or `quota` selectors.
- Fails over between targets, applies exponential cooldowns, enforces timeouts and concurrency limits, and detects stalled streams.
- Issues client API keys with model, provider and IP restrictions and scoped token, request or cost quotas.
- Uses OAuth subscription accounts (Claude, ChatGPT/Codex, GitHub Copilot) as routing targets.
- Polls provider plan quotas and balances with built-in quota checkers.
- Proxies remote and locally launched MCP servers behind ModelMux keys, with an OAuth authorization server for MCP clients.
- Encrypts stored secrets when `ENCRYPTION_KEY` is set.

## Dashboard and Management API

The React dashboard is served at `/ui/`. Sign in with `ADMIN_KEY` to manage providers, aliases, keys, quotas and MCP servers, and to explore logs, errors, debug traces and usage charts. The same operations are available under `/v0/management/*`.

## Quick Start

Requires [Bun](https://bun.sh/) 1.4.4 or newer.

```bash
git clone https://github.com/jawaddev921-afk/modelmux.git
cd modelmux
bun install
ADMIN_KEY="change-me" bun run dev
```

## Tests

```bash
bun test
```
