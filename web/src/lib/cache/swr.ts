type CacheEntry<T> = {
  data?: T;
  updatedAt?: number;
  inflight?: Promise<T>;
  error?: unknown;
};

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key);
}

export function setCached<T>(key: string, entry: CacheEntry<T>) {
  cache.set(key, entry);
}

export async function revalidate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const prev = (cache.get(key) ?? {}) as CacheEntry<T>;
  if (prev.inflight) return prev.inflight;

  const inflight = (async () => {
    const data = await fetcher();
    cache.set(key, { data, updatedAt: Date.now() } satisfies CacheEntry<T>);
    return data;
  })();

  cache.set(key, { ...prev, inflight } satisfies CacheEntry<T>);
  try {
    return await inflight;
  } catch (e) {
    cache.set(key, { ...prev, inflight: undefined, error: e } satisfies CacheEntry<T>);
    throw e;
  }
}

