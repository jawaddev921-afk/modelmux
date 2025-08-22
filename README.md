# ModelMux

ModelMux is a self-hosted LLM gateway that gives your clients one consistent API while it routes requests across many model providers.

## What This Project Does

- Accepts OpenAI Chat Completions, Completions, Anthropic Messages and Gemini `generateContent` requests.
- Translates each request into the API format the chosen provider speaks.
- Maps model aliases to provider targets and picks one with `random`, `in_order`, `cost`, `performance`, `latency` or `usage` selectors.
- Fails over to the next target and puts failing providers on cooldown.
- Stores request usage, cost and errors in SQLite or PostgreSQL.

## Quick Start

Requires [Bun](https://bun.sh/) 1.4.4 or newer.

```bash
git clone https://github.com/jawaddev921-afk/modelmux.git
cd modelmux
bun install
cd packages/backend
ADMIN_KEY="change-me" DATABASE_URL="sqlite://./data/modelmux.db" bun run src/index.ts
```

Point an OpenAI-compatible client at `http://localhost:4000/v1`.
