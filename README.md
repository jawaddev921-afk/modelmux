# ModelMux

ModelMux is a self-hosted LLM gateway that gives your clients one consistent API while it routes requests across many model providers.

## What This Project Does

- Accepts OpenAI Chat Completions, Completions and Responses, Anthropic Messages, Gemini `generateContent`, embeddings, image, speech and transcription requests.
- Translates each request into the API format the chosen provider speaks.
- Maps model aliases to provider targets and picks one with `random`, `in_order`, `cost`, `performance`, `latency`, `usage` or `quota` selectors.
- Fails over between targets, applies exponential cooldowns and detects stalled streams.
- Issues client API keys with model restrictions and token, request or cost quotas.
- Stores all configuration, usage and logs in SQLite or PostgreSQL.

## Dashboard and Management API

The React dashboard is served at `/ui/`. Sign in with `ADMIN_KEY` to manage providers, model aliases, keys and quotas, browse request logs, errors and debug traces, and view usage and performance charts. Everything the dashboard does is also available through the REST API under `/v0/management/*` using the `x-admin-key` header.

## Quick Start

Requires [Bun](https://bun.sh/) 1.4.4 or newer.

```bash
git clone https://github.com/jawaddev921-afk/modelmux.git
cd modelmux
bun install
ADMIN_KEY="change-me" bun run dev
```

Open the printed URL and add your first provider.

## Tests

```bash
bun test
```
