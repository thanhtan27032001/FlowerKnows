function isShareCancel(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  // User dismissed the share sheet — not a failure (US-36 AC#6).
  return err.name === "AbortError" || err.name === "NotAllowedError";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Deliver a PNG blob to the user.
 *
 * - iOS Safari (and similar): Web Share API with files → native share sheet
 *   ("Save Image" into Photos). Plain `<a download>` does not work there.
 * - Desktop / most Android: `<a download>` fallback.
 */
export async function deliverPngBlob(
  blob: Blob,
  filename: string
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (err) {
      if (isShareCancel(err)) {
        return "shared";
      }
      throw err;
    }
  }

  downloadBlob(blob, filename);
  return "downloaded";
}
