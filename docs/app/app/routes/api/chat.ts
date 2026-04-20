import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  tool,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { cloudflareLoadContext } from '@/lib/cloudflare-context';
import { source } from '@/lib/source';
import { Document, type DocumentData } from 'flexsearch';

import type { Route } from './+types/chat';

interface CustomDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
}

export type ChatUIMessage = UIMessage<
  never,
  {
    client: {
      location: string;
    };
  }
>;

let searchServerPromise: Promise<Document<CustomDocument>> | undefined;

async function createSearchServer() {
  const search = new Document<CustomDocument>({
    document: {
      id: 'url',
      index: ['title', 'description', 'content'],
      store: true,
    },
  });

  const docs = await chunkedAll(
    source.getPages().map(async (page) => {
      if (!('getText' in page.data)) return null;

      return {
        title: page.data.title,
        description: page.data.description,
        url: page.url,
        content: await page.data.getText('processed'),
      } as CustomDocument;
    }),
  );

  for (const doc of docs) {
    if (doc) search.add(doc);
  }

  return search;
}

function getSearchServer() {
  searchServerPromise ??= createSearchServer();
  return searchServerPromise;
}

async function chunkedAll<O>(promises: Promise<O>[]): Promise<O[]> {
  const SIZE = 50;
  const out: O[] = [];
  for (let i = 0; i < promises.length; i += SIZE) {
    out.push(...(await Promise.all(promises.slice(i, i + SIZE))));
  }
  return out;
}

function openRouterConfig(context: Route.ActionArgs['context']) {
  const cf = context.get(cloudflareLoadContext)?.env;
  const apiKey = normalizeApiKey(cf?.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY);
  return {
    apiKey,
    model: cf?.OPENROUTER_MODEL ?? process.env.OPENROUTER_MODEL ?? 'google/gemini-3.1-flash-lite-preview',
  };
}

function normalizeApiKey(value: string | undefined) {
  if (!value) return undefined;

  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  const withoutBearer = trimmed.replace(/^Bearer\s+/i, '');
  return withoutBearer || undefined;
}

function getMessageText(message: ChatUIMessage): string {
  return message.parts
    ?.flatMap((part) => {
      if (part.type === 'text') return [part.text];
      if (part.type === 'data-client') {
        return [`[Client Context: ${JSON.stringify(part.data)}]`];
      }
      return [];
    })
    .join('\n')
    .trim() ?? '';
}

async function searchDocs(query: string, limit = 6): Promise<CustomDocument[]> {
  const search = await getSearchServer();
  const results = await search.searchAsync(query, { limit, merge: true, enrich: true });
  const entries = Array.isArray(results) ? results : [];

  return entries
    .flatMap((entry) => ('result' in entry && Array.isArray(entry.result) ? entry.result : []))
    .map((item) => item.doc)
    .filter((doc): doc is CustomDocument => Boolean(doc));
}

function buildSearchContext(docs: CustomDocument[]) {
  if (docs.length === 0) {
    return 'No relevant documentation results were found.';
  }

  return docs
    .map((doc, index) => {
      const excerpt = doc.content.replace(/\s+/g, ' ').trim().slice(0, 1800);
      return [
        `Result ${index + 1}:`,
        `Title: ${doc.title}`,
        `URL: ${doc.url}`,
        `Description: ${doc.description}`,
        `Content: ${excerpt}`,
      ].join('\n');
    })
    .join('\n\n');
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
) {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${apiKey}`);
  headers.set('content-type', 'application/json');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const detail = body.error?.message ?? `OpenRouter returned ${response.status}.`;
    throw new Error(`OpenRouter request failed: ${detail}`);
  }

  return body.choices?.[0]?.message?.content?.trim() || 'I could not generate an answer.';
}

/** System prompt, you can update it to provide more specific information */
const systemPrompt = [
  'You are an AI assistant for a documentation site.',
  'Use the `search` tool to retrieve relevant docs context before answering when needed.',
  'The `search` tool returns raw JSON results from documentation. Use those results to ground your answer and cite sources as markdown links using the document `url` field when available.',
  'If you cannot find the answer in search results, say you do not know and suggest a better search query.',
].join('\n');

export async function action(args: Route.ActionArgs) {
  const req = args.request;
  const reqJson = (await req.json()) as { messages?: ChatUIMessage[] };
  const messages = reqJson.messages ?? [];

  const { apiKey, model } = openRouterConfig(args.context);
  if (!apiKey) {
    return Response.json(
      {
        error:
          'OPENROUTER_API_KEY is not set. For production run `wrangler secret put OPENROUTER_API_KEY`. For local dev add it to `.dev.vars`.',
      },
      { status: 503 },
    );
  }

  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const query = latestUserMessage ? getMessageText(latestUserMessage) : '';
  const docs = query ? await searchDocs(query) : [];
  const docsContext = buildSearchContext(docs);

  const upstreamMessages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'system' as const,
      content: [
        'Relevant docs context follows. Prefer this information over prior assumptions.',
        'Cite sources as markdown links using the URL exactly as provided.',
        docsContext,
      ].join('\n\n'),
    },
    ...messages
      .map((message) => {
        const content = getMessageText(message);
        if (!content) return null;
        if (message.role === 'assistant') {
          return { role: 'assistant' as const, content };
        }
        return { role: 'user' as const, content };
      })
      .filter((message): message is { role: 'user' | 'assistant'; content: string } =>
        Boolean(message),
      ),
  ];

  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const textId = crypto.randomUUID();
      const answer = await callOpenRouter(apiKey, model, upstreamMessages);

      writer.write({ type: 'start' });
      writer.write({ type: 'text-start', id: textId });
      writer.write({ type: 'text-delta', id: textId, delta: answer });
      writer.write({ type: 'text-end', id: textId });
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}


export type SearchTool = typeof searchTool;

const searchTool = tool({
  description: 'Search the docs content and return raw JSON results.',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().int().min(1).max(100).default(10),
  }),
  async execute({ query, limit }) {
    const search = await getSearchServer();
    return await search.searchAsync(query, { limit, merge: true, enrich: true });
  },
});
