import { useCallback, useEffect, useState } from "react";

export interface PortalDataState<TData> {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

// Screens unmount on every tab switch; keyed entries let a remounted screen
// show its last data instantly while a background refresh replaces it.
const portalDataCache = new Map<string, unknown>();

export function clearPortalDataCache(): void {
  portalDataCache.clear();
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unable to load portal data");
}

export function usePortalData<TData>(
  enabled: boolean,
  load: () => Promise<TData>,
  cacheKey?: string,
): PortalDataState<TData> {
  const [data, setData] = useState<TData | null>(() =>
    enabled && cacheKey && portalDataCache.has(cacheKey) ? (portalDataCache.get(cacheKey) as TData) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    let cancelled = false;
    const hasCached = Boolean(cacheKey && portalDataCache.has(cacheKey));
    if (!hasCached) {
      setLoading(true);
    }
    setError(null);

    load()
      .then((nextData) => {
        if (cacheKey) {
          portalDataCache.set(cacheKey, nextData);
        }
        if (!cancelled) {
          setData(nextData);
          setError(null);
        }
      })
      .catch((nextError: unknown) => {
        // A failed background refresh keeps showing the cached data.
        if (!cancelled && !hasCached) {
          setError(toError(nextError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, load, retryKey]);

  return { data, loading, error, retry };
}
