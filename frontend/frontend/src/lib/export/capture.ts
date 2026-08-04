/**
 * Capture an HTMLElement to PNG via html2canvas.
 *
 * html2canvas 1.4.x cannot parse Tailwind v4 color functions (oklch / oklab /
 * color-mix). We clone into an isolated host and strip stylesheets in `onclone`
 * so only the table's inline hex/rgb styles remain.
 */
export async function captureElementAsPng(
  source: HTMLElement
): Promise<HTMLCanvasElement> {
  const html2canvasModule = await import("html2canvas");
  const html2canvas = html2canvasModule.default;

  const width = Math.max(
    source.scrollWidth,
    source.getBoundingClientRect().width
  );
  const host = document.createElement("div");
  host.setAttribute("data-export-table-host", "");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "z-index:-1",
    "background:#ffffff",
    "color:#111111",
    `width:${Math.ceil(width)}px`,
  ].join(";");

  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.width = "100%";
  clone.style.backgroundColor = "#ffffff";
  clone.style.color = "#111111";
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    return await html2canvas(clone, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      width: Math.ceil(width),
      windowWidth: Math.ceil(width),
      onclone: (clonedDoc, clonedEl) => {
        clonedDoc
          .querySelectorAll('style, link[rel="stylesheet"]')
          .forEach((node) => node.remove());

        const override = clonedDoc.createElement("style");
        override.textContent = `
          html, body {
            background: #ffffff !important;
            color: #111111 !important;
          }
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            caret-color: transparent !important;
            outline-color: transparent !important;
            box-sizing: border-box !important;
          }
        `;
        clonedDoc.head.appendChild(override);
        clonedEl.style.backgroundColor = "#ffffff";
        clonedEl.style.color = "#111111";
      },
    });
  } finally {
    host.remove();
  }
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create PNG blob"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
