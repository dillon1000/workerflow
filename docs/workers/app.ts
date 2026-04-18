import { createRequestHandler, RouterContextProvider } from 'react-router';

import { cloudflareLoadContext, type CloudflareEnv } from '../app/lib/cloudflare-context';

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const loadContext = new RouterContextProvider(
      new Map([[cloudflareLoadContext, { env, ctx }]]),
    );
    return requestHandler(request, loadContext);
  },
};
