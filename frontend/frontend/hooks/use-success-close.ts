"use client";

import { useCallback, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * Brief success beat before closing a dialog/sheet (skipped when reduced motion).
 */
export function useSuccessClose(delayMs = 250) {
  const [succeeded, setSucceeded] = useState(false);
  const reduced = usePrefersReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSuccess = useCallback(
    async (after: () => void) => {
      setSucceeded(true);
      const ms = reduced ? 0 : delayMs;
      await new Promise<void>((resolve) => {
        timerRef.current = setTimeout(resolve, ms);
      });
      after();
      setSucceeded(false);
    },
    [delayMs, reduced]
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSucceeded(false);
  }, []);

  return { succeeded, runSuccess, reset };
}
