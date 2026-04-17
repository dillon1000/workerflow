
---

# Workerflow

![Workerflow Image](![Workerflow, the opensource, cloudflare-native workflow editor](https://flare.dillon.network/global-assets/workerflow-banner.png))

Build, connect, and run automated workflows, all on Cloudflare.

Workerflow is a canvas based workflow editor with durable execution. You can design automations visually, wire up your integrations, and let Cloudflare Workflows handle the rest.

## What it does

- **Visual editor** — drag-and-drop canvas built on React Flow.
- **Durable** — runs on Cloudflare Workflows, meaning your automations can survive retries, timeouts.
- **Your integrations** — GitHub issue creation, Linear ticket creation, webhook triggers, Workers AI, out of the box
- **Reusable connections** — store provider credentials once in KV (encrypted), reference them anywhere
- **Scheduled & event-driven** — cron dispatching and verified webhook triggers so you can ingest from anything.

## Stack

React, Vite, Tailwind CSS, Hono, Better Auth, Drizzle ORM, Jotai, React Flow.

## Secrets model

Operational secrets (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SECRETS_KEY`, `DATABASE_URL`) live in env files. Everything else, whether it's GitHub tokens, Linear API keys, webhook secrets are configured in the app as connections.

## Get started

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
# Set Hyperdrive, KV, and Workflow bindings in wrangler.jsonc
pnpm install && pnpm dev
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start local dev server |
| `pnpm type-check` | TypeScript validation |
| `pnpm fix` | Lint + format |
| `pnpm build` | Production build |
| `pnpm db:generate` | Generate migrations |
| `pnpm db:push` | Push schema to DB |

## Adding integrations

Refer to: [`docs/PLUGIN_DEVELOPMENT.md`](./docs/PLUGIN_DEVELOPMENT.md)

---