'use client';

import { useEffect, useMemo, useState } from "react";
import { getCached, revalidate } from "@/lib/cache/swr";

export function useSWRCache<T>({
  key,
  enabled,
  ttlMs = 30_000,
  fetcher,
}: {
  key: string;
  enabled: boolean;
  ttlMs?: number;
  fetcher: () => Promise<T>;
}) {
  const initial = useMemo(() => getCached<T>(key), [key]);
  const [data, setData] = useState<T | undefined>(initial?.data);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState<boolean>(() => (enabled ? !initial?.data : false));

  const isFresh = !!initial?.updatedAt && Date.now() - initial.updatedAt < ttlMs;

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      const next = await revalidate<T>(key, fetcher);
      setData(next);
      return next;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    // Serve cached instantly; refresh in background if stale/missing.
    const entry = getCached<T>(key);
    if (entry?.data !== undefined) setData(entry.data);
    if (entry?.data === undefined || !isFresh) {
      void refresh();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, ttlMs]);

  return { data, error, loading, refresh };
}

