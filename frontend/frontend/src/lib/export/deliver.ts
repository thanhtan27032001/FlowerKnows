function isShareAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
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
  // Delay revoke so Safari can start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/** Probe whether this browser can share image files (iOS Safari, some Android). */
export function canNativeShareImageFile(): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    return false;
  }
  try {
    const probe = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "probe.png", {
      type: "image/png",
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Open the native share sheet with a PNG file (iOS → Save Image / Photos).
 * Must be called directly from a user gesture (click) with a ready File —
 * do not await heavy work (html2canvas) before calling this.
 *
 * Returns:
 * - `shared` — sheet completed or user cancelled (AbortError)
 * - `unavailable` — share not supported / blocked → caller should download
 */
export async function nativeSharePngFile(
  file: File,
  title: string
): Promise<"shared" | "unavailable"> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function"
  ) {
    return "unavailable";
  }

  const payload: ShareData = { files: [file], title };
  if (
    typeof navigator.canShare === "function" &&
    !navigator.canShare(payload)
  ) {
    return "unavailable";
  }

  try {
    await navigator.share(payload);
    return "shared";
  } catch (err) {
    // User closed the sheet — not an error.
    if (isShareAbort(err)) return "shared";
    // NotAllowedError / TypeError / etc. → fall back to download.
    console.warn("Native share unavailable, falling back to download", err);
    return "unavailable";
  }
}

export function downloadPngBlob(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}

/**
 * Deliver a PNG blob: prefer native share when available, else download.
 * Prefer calling `nativeSharePngFile` from a click handler with a pre-built
 * File so the user-activation gesture is preserved.
 */
export async function deliverPngBlob(
  blob: Blob,
  filename: string
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (canNativeShareImageFile()) {
    const result = await nativeSharePngFile(file, filename);
    if (result === "shared") return "shared";
  }
  downloadPngBlob(blob, filename);
  return "downloaded";
}
