import { normalizePageSize } from "./limits";

export interface PaginationPage<TItem, TCursor = string | null> {
  items: TItem[];
  nextCursor?: TCursor;
}

export async function collectPaginated<TItem, TCursor = string | null>(input: {
  initialCursor?: TCursor;
  maxPages?: number;
  getPage: (cursor?: TCursor) => Promise<PaginationPage<TItem, TCursor>>;
}) {
  const items: TItem[] = [];
  let cursor = input.initialCursor;
  const maxPages = normalizePageSize(input.maxPages ?? 10, 10, 100);

  for (let index = 0; index < maxPages; index += 1) {
    const page = await input.getPage(cursor);
    items.push(...page.items);
    if (!page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }

  return items;
}

export function cursorPage<TItem, TCursor = string | null>(
  items: TItem[],
  nextCursor?: TCursor,
): PaginationPage<TItem, TCursor> {
  return {
    items,
    nextCursor,
  };
}
