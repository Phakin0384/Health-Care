'use client';

import { useEffect, useState } from 'react';

/**
 * A clock that re-renders the component on an interval.
 *
 * Relative labels ("Started 4m ago") and the typing indicator are derived from
 * stored timestamps, so without this they would only refresh when the server
 * happened to broadcast. A session sitting untouched would show a frozen age.
 */
export function useNow(intervalMs: number = 1_000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
