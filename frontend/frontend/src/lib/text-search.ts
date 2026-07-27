/** Case- and accent-insensitive text helpers (Vietnamese-friendly). */
export function foldText(input: string | null | undefined): string {
  if (!input || !input.trim()) return "";
  const lower = input.trim().toLowerCase().replaceAll("đ", "d");
  return lower.normalize("NFD").replace(/\p{M}+/gu, "");
}

export function containsFolded(
  haystack: string | null | undefined,
  foldedNeedle: string
): boolean {
  if (!foldedNeedle) return true;
  return foldText(haystack).includes(foldedNeedle);
}
