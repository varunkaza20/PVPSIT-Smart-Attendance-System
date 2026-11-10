import { DependencyList, useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Loads report data whenever `deps` change. Older in-flight requests are cancelled,
 * so a slow earlier response can never overwrite a newer one.
 */
export function useReportData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    load(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(err => {
        if (axios.isCancel(err) || controller.signal.aborted) return;
        const message = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Could not load the report. Please try again.';
        setError(message);
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return { data, loading, error };
}
