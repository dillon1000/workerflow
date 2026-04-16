# AGENTS.md

This project uses `pnpm` as its package manager. Always use `pnpm` for all package operations.

## Package Manager Rules

- Install packages with `pnpm add <package>`.
- Run scripts with `pnpm <script-name>`.
- Add shadcn/ui components with `pnpm dlx shadcn@latest add <component>`.
- Never use `npm` or `yarn` in this project.

## Required Completion Workflow

Before considering work complete, always run these commands in order:

1. `pnpm type-check`
2. `pnpm fix`

If either command fails:

1. Read the error output carefully.
2. Fix the relevant files.
3. Re-run the commands.
4. Repeat until all checks pass.

Do not leave the project with type errors or linting issues.

## Documentation Rules

- Do not use emojis in code or documentation.
- Do not include file or folder structure diagrams in the README.
- Do not add Markdown documentation unless the user explicitly asks for it.

## Component Rules

- Prefer shadcn/ui components whenever they exist.
- Do not create custom components that duplicate shadcn/ui behavior.
- Use Sonner, shadcn `Dialog`, or shadcn `AlertDialog` instead of native `alert()` or `confirm()`.

## Database Rules

- Define schema changes in code first.
- Generate migrations with `pnpm db:generate`.
- Apply schema updates with `pnpm db:push`.
- Never write SQL migration files by hand in `drizzle/`.

## Code Cleanliness Rules

- Remove unused imports, variables, and functions instead of prefixing them with `_`, unless the parameter is intentionally required by a signature.
- Use the correct Jotai hook for the job:
- `useAtom(atom)` when both value and setter are needed.
- `useAtomValue(atom)` when only reading.
- `useSetAtom(atom)` when only writing.
- Do not create barrel files that re-export from other files.

## Plugin Rules

- Plugin step files must use `fetch` directly for API integrations.
- Do not add SDK package dependencies for providers like GitHub, Linear, or others.
- Do not add a `dependencies` field to plugin definitions.
- The reason is supply-chain safety and keeping plugin execution transparent.

## Secrets and Integrations

- GitHub and Linear webhook secrets are configured in the app through reusable connections and stored in KV.
- Do not add env fallbacks for provider webhook secrets.
- Only app-wide operational secrets such as `BETTER_AUTH_SECRET` and `SECRETS_KEY` belong in env files.

## Current Extension Model

- This repo does not yet use auto-discovered plugin folders.
- A "plugin" currently means:
- adding a node manifest in `src/lib/workflow/templates.ts`
- adding editor-facing handling where needed in the client
- adding runtime execution in `worker/services/runtime.ts`
- adding trigger matching in `worker/routes/triggers.ts` when relevant
- adding connection validation in `worker/routes/connections.ts` when relevant
