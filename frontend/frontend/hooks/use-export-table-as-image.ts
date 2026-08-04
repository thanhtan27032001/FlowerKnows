"use client";

import { useCallback, useState } from "react";
import { exportTableImage } from "@/src/lib/export/export-table-image";

/**
 * Shared hook for US-36 / US-37 packing-list image export.
 * Wraps html2canvas capture + Web Share / download delivery with busy state.
 */
export function useExportTableAsImage() {
  const [exporting, setExporting] = useState(false);

  const exportFromElement = useCallback(
    async (element: HTMLElement, filename: string) => {
      setExporting(true);
      try {
        return await exportTableImage(element, filename);
      } finally {
        setExporting(false);
      }
    },
    []
  );

  return { exporting, exportFromElement };
}
