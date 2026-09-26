/** Case- and accent-insensitive text helpers (Vietnamese-friendly). */
export function foldText(input: string | null | undefined): string {
  if (!input || !input.trim()) return "";
  const lower = input.trim().toLowerCase().replaceAll("đ", "d");
  return lower.normalize("NFD").replace(/\p{M}+/gu, "");
}

/** Vietnamese-aware alphabetical compare, consistent with foldText's normalization. */
export function compareFolded(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  return foldText(a).localeCompare(foldText(b), "vi");
}

export function containsFolded(
  haystack: string | null | undefined,
  foldedNeedle: string
): boolean {
  if (!foldedNeedle) return true;
  return foldText(haystack).includes(foldedNeedle);
}
