import {
  captureElementAsPng,
  canvasToPngBlob,
} from "@/src/lib/export/capture";
import { deliverPngBlob } from "@/src/lib/export/deliver";

/**
 * Shared US-36 / US-37 export entry point: capture a rendered packing-list
 * element and deliver it via Web Share (iOS) or `<a download>` (elsewhere).
 */
export async function exportTableImage(
  element: HTMLElement,
  filename: string
): Promise<"shared" | "downloaded"> {
  const canvas = await captureElementAsPng(element);
  const blob = await canvasToPngBlob(canvas);
  return deliverPngBlob(blob, filename);
}
