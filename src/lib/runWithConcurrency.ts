/** Run async work on `items` with at most `limit` concurrent tasks. */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  let next = 0;
  const cap = Math.max(1, Math.min(limit, items.length));

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) {
        break;
      }
      results[i] = await fn(items[i]!, i);
    }
  };

  await Promise.all(Array.from({ length: cap }, () => worker()));
  return results;
}
