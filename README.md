# Workerflow

Workerflow is a Cloudflare-native visual workflow editor built with React, Vite, Tailwind CSS, Hono, Better Auth, Drizzle ORM, Jotai, and React Flow.

It is designed around:

- multiple workflows per user
- a canvas-first editor
- reusable provider connections stored in KV
- durable execution through Cloudflare Workflows
- first-party integrations like GitHub, Linear, Workers AI, webhooks, and PostgreSQL

## Current Status

This repo now includes:

- a Tailwind-based application shell and editor UI
- dashboard, workflows, workflow settings, runs, connections, and login pages
- Better Auth-backed auth routes
- PostgreSQL-backed workflow, run, and connection persistence
- KV-backed encrypted reusable connection secrets
- a generic Cloudflare Workflow runner
- dynamic schedule dispatching
- GitHub webhook trigger verification from in-app connection secrets
- Linear webhook trigger verification from in-app connection secrets
- real GitHub issue creation and Linear ticket creation via direct `fetch`

## Secrets Model

Operational secrets belong in env files:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `SECRETS_KEY`

Provider secrets do not belong in env files. They should be created inside the app as reusable connections and stored in KV.

Examples:

- GitHub personal access token
- GitHub webhook secret
- Linear API key
- Linear webhook secret

GitHub and Linear webhook verification no longer use env fallbacks.

## Local Setup

1. Copy `.env.example` to `.env` if you want shell-visible values for tooling.
2. Copy `.dev.vars.example` to `.dev.vars` for local Wrangler runtime secrets.
3. Set real Hyperdrive, KV, and Workflow bindings in `wrangler.jsonc`.
4. Install dependencies with `pnpm install`.
5. Generate Worker types with `pnpm cf-typegen`.
6. Run the app with `pnpm dev`.

## Core Commands

- `pnpm dev`
- `pnpm type-check`
- `pnpm fix`
- `pnpm build`
- `pnpm cf-typegen`
- `pnpm db:generate`
- `pnpm db:push`

## Development Rules

This repo uses `pnpm` only.

- Install packages with `pnpm add`
- Run scripts with `pnpm <script-name>`
- Add shadcn/ui components with `pnpm dlx shadcn@latest add <component>`

Before completing work:

1. Run `pnpm type-check`
2. Run `pnpm fix`

## How to Extend It

The current extension model is code-first rather than auto-discovered plugin folders.

To add a new workflow capability:

1. Add the shared node kind in `src/lib/workflow/types.ts`
2. Register the manifest in `src/lib/workflow/templates.ts`
3. Extend editor handling where needed in the client
4. Add runtime execution in `worker/services/runtime.ts`
5. Add trigger matching in `worker/routes/triggers.ts` if it is a trigger
6. Add connection testing in `worker/routes/connections.ts` if it needs credentials

For a fuller walkthrough, see [docs/PLUGIN_DEVELOPMENT.md](./docs/PLUGIN_DEVELOPMENT.md).

## Notes

- This repo intentionally avoids provider SDK dependencies for workflow plugins and uses direct `fetch` instead.
- The current implementation uses a generic runtime interpreter on top of Cloudflare Workflows rather than per-workflow generated code.
- The editor and runtime are functional, but deployment still requires real Cloudflare binding IDs and secrets in `wrangler.jsonc` and local env files.
