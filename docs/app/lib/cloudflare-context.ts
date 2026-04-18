import { createContext } from 'react-router';

/** Worker bindings / secrets — keep in sync with `workers/app.ts` and wrangler. */
export interface CloudflareEnv {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
}

export type CloudflareLoadContext = {
  env: CloudflareEnv;
  ctx: ExecutionContext;
};

/** Set in `workers/app.ts` for each request; absent when running under Node (`react-router-serve`). */
export const cloudflareLoadContext = createContext<CloudflareLoadContext | undefined>(undefined);
