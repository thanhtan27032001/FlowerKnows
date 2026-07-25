"use client";

import { useEffect, useState } from "react";

/** Prefer matching the viewport sync on first client paint to avoid a Dialog→Sheet flash. */
function getIsMobile(breakpointPx: number) {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches;
}

export function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(() => getIsMobile(breakpointPx));

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpointPx]);

  return isMobile;
}
