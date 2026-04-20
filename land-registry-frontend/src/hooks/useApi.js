import { useState, useEffect, useCallback } from "react";

/**
 * Generic data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi(parcelsApi.getById, [id]);
 */
export function useApi(apiFn, deps = [], immediate = true) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      setData(res.data.data ?? res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message || "An error occurred.");
      return null;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) fetch(...deps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: fetch };
}

/**
 * Mutation hook — for POST/PATCH/DELETE operations.
 *
 * Usage:
 *   const { mutate, loading, error } = useMutation(transfersApi.initiate);
 *   await mutate(payload);
 */
export function useMutation(apiFn) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const mutate = async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "An error occurred.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
