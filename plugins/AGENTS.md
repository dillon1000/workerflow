# Plugin Development Notes

Use the plugin scaffold to create a new provider:

```bash
pnpm create-plugin
```

Refresh the generated plugin index after adding, removing, or renaming plugin folders:

```bash
pnpm discover-plugins
```

Plugin folders live in `plugins/<plugin-id>/` and normally contain:

```text
plugins/<plugin-id>/
  credentials.ts
  icon.tsx
  index.ts
  steps/
    <step-id>.ts
  test.ts
  trigger.ts
```

This repo’s current plugin contract is:

- Export `plugin: WorkflowPluginManifest` from `plugins/<plugin-id>/index.ts`.
- Keep `plugin.id` equal to the folder name.
- Define reusable credentials in the manifest `connections` array.
- Use `fetch` directly inside step files and tests. Do not add provider SDK dependencies.
- Export `run: WorkflowStepRunner` from each `steps/<step-id>.ts` file.
- Export `testConnection: ConnectionTestRunner` from `test.ts` when the provider supports connection testing.
- Export `triggerHandlers: WorkflowTriggerHandler[]` from `trigger.ts` when the provider supports inbound webhooks.

Current extension points are auto-discovered:

- `plugins/*/index.ts`
- `plugins/*/icon.tsx`
- `plugins/*/steps/*.ts`
- `plugins/*/test.ts`
- `plugins/*/trigger.ts`

Normal plugin work should not require manual edits to:

- `apps/web/src/lib/workflow/templates.ts`
- `apps/web/worker/routes/triggers.ts`
- `apps/web/worker/routes/connections.ts`
- `apps/web/worker/services/runtime.ts`

Before finishing plugin work, run:

```bash
pnpm type-check
pnpm fix
```
