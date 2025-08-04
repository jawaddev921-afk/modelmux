# ModelMux

ModelMux is a self-hosted LLM gateway that gives your clients one consistent API while it routes requests across many model providers.

## Goals

- Accept requests in the API formats clients already use (OpenAI, Anthropic, Gemini).
- Route each request to one of several upstream providers based on simple rules.
- Record usage, cost and errors in one place.

This project is in early development.
