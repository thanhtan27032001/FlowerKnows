"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/** Briefly highlight entity IDs after a mutation so staff can confirm the change. */
export function useFlashIds(durationMs = 600) {
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const reduced = usePrefersReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(
    (ids: Iterable<string>) => {
      const next = new Set(ids);
      if (next.size === 0) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setFlashIds(next);
      const ms = reduced ? 0 : durationMs;
      timerRef.current = setTimeout(() => setFlashIds(new Set()), ms);
    },
    [durationMs, reduced]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { flashIds, flash };
}
