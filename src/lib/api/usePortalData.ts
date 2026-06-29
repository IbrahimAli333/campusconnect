import { useCallback, useEffect, useState } from "react";

export interface PortalDataState<TData> {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unable to load portal data");
}

export function usePortalData<TData>(enabled: boolean, load: () => Promise<TData>): PortalDataState<TData> {
  const [data, setData] = useState<TData | null>(null);
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
    setLoading(true);
    setError(null);

    load()
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData);
          setError(null);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
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
