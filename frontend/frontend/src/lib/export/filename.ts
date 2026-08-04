function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Sanitize a name for use inside a download filename. */
export function sanitizeFilenamePart(value: string, maxLen = 60): string {
  const cleaned = value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "export").slice(0, maxLen);
}

export function ordersExportFilename(date = new Date()): string {
  return `orders-export-${ymd(date)}.png`;
}

export function campaignExportFilename(
  campaignName: string,
  date = new Date()
): string {
  return `campaign-${sanitizeFilenamePart(campaignName)}-export-${ymd(date)}.png`;
}
