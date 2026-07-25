"use client";

import { cn } from "@/lib/utils";

export function PageFade({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("fk-page-fade", className)}>{children}</div>;
}
