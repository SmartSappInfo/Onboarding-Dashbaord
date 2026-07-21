/**
 * @fileOverview Bounded-concurrency helpers.
 *
 * `Promise.all` / `Promise.allSettled` over a mapped array starts every task at
 * once. Against Firestore or a rate-limited third-party API that means an
 * organization with hundreds of records can exhaust connections, hit rate limits
 * or blow the request budget. These helpers keep the fan-out bounded.
 *
 * Deliberately dependency-free (no p-limit/p-map) — the whole implementation is
 * a few lines and is unit-tested.
 */

/**
 * Run `fn` over `items` with at most `limit` promises in flight.
 *
 * Behaves like `Promise.allSettled`: results come back in **input order** and a
 * rejection never aborts the remaining work. A `limit` below 1 runs serially
 * rather than stalling.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  if (items.length === 0) return results;

  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
