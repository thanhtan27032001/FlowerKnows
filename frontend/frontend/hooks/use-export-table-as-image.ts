"use client";

import { useCallback, useState } from "react";
import {
  captureElementAsPng,
  canvasToPngBlob,
} from "@/src/lib/export/capture";
import {
  canNativeShareImageFile,
  downloadPngBlob,
  nativeSharePngFile,
} from "@/src/lib/export/deliver";

export type PreparedExportImage = {
  blob: Blob;
  file: File;
  objectUrl: string;
};

/**
 * Capture an element to a ready-to-share/download PNG.
 * Call this *before* the share/download click so `navigator.share` keeps
 * the user gesture (required on iOS).
 */
export async function prepareExportImage(
  element: HTMLElement,
  filename: string
): Promise<PreparedExportImage> {
  const canvas = await captureElementAsPng(element);
  const blob = await canvasToPngBlob(canvas);
  const file = new File([blob], filename, { type: "image/png" });
  const objectUrl = URL.createObjectURL(blob);
  return { blob, file, objectUrl };
}

export function revokeExportImage(prepared: PreparedExportImage | null): void {
  if (prepared?.objectUrl) {
    URL.revokeObjectURL(prepared.objectUrl);
  }
}

/**
 * Shared hook for US-36 / US-37 packing-list image export.
 * Prepare first (async), then share/download from a click (sync gesture).
 */
export function useExportTableAsImage() {
  const [preparing, setPreparing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const supportsNativeShare = canNativeShareImageFile();

  const prepareFromElement = useCallback(
    async (element: HTMLElement, filename: string) => {
      setPreparing(true);
      try {
        return await prepareExportImage(element, filename);
      } finally {
        setPreparing(false);
      }
    },
    []
  );

  const sharePrepared = useCallback(async (prepared: PreparedExportImage) => {
    setDelivering(true);
    try {
      const result = await nativeSharePngFile(
        prepared.file,
        prepared.file.name
      );
      if (result === "unavailable") {
        downloadPngBlob(prepared.blob, prepared.file.name);
        return "downloaded" as const;
      }
      return "shared" as const;
    } finally {
      setDelivering(false);
    }
  }, []);

  const downloadPrepared = useCallback((prepared: PreparedExportImage) => {
    downloadPngBlob(prepared.blob, prepared.file.name);
  }, []);

  return {
    preparing,
    delivering,
    supportsNativeShare,
    prepareFromElement,
    sharePrepared,
    downloadPrepared,
  };
}
