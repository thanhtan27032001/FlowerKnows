"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  /** Accessible / tooltip label when idle. */
  label: string;
  disabled?: boolean;
  className?: string;
};

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for older WebViews / insecure contexts.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

/** Compact icon-only copy control meant to sit inline next to a value. */
export function CopyButton({
  text,
  label,
  disabled = false,
  className,
}: Props) {
  const t = useTranslations("common.copy");
  const [copied, setCopied] = useState(false);
  const trimmed = text.trim();
  const canCopy = !disabled && trimmed.length > 0;

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      disabled={!canCopy}
      className={cn("shrink-0 text-muted-foreground", className)}
      aria-label={copied ? t("copied") : label}
      title={copied ? t("copied") : label}
      onClick={(event) => {
        event.stopPropagation();
        void (async () => {
          try {
            await writeClipboard(trimmed);
            setCopied(true);
          } catch (err) {
            console.error("Copy failed", err);
          }
        })();
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

/** Join phone + address for shipping paste (skips blank parts). */
export function formatPhoneWithAddress(
  phone: string | null | undefined,
  address: string | null | undefined
): string {
  return [phone?.trim(), address?.trim()].filter(Boolean).join(", ");
}
