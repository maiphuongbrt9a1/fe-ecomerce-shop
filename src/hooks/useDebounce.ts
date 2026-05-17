"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` delayed by `delayMs`. The returned value only updates after
 * the input has been stable for the delay window — used to throttle expensive
 * downstream work (e.g. server-side search refetch) when the user is typing.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
