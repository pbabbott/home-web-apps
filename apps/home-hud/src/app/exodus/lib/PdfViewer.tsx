'use client';

import { useEffect, useRef, useState } from 'react';
import { Typography } from '@abbottland/fui-components';

interface PdfViewerProps {
  /** Object URL of the PDF. */
  url: string;
  title: string;
}

/**
 * Draws a PDF's pages to canvases with pdf.js. An iframe cannot do this:
 * mobile browsers (Android Chrome, iOS Safari) do not render PDFs inline and
 * show an "Open" placeholder instead.
 */
export function PdfViewer({ url, title }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let destroy: (() => void) | undefined;

    void (async () => {
      try {
        // Imported here, not at the top: pdf.js touches browser globals.
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        const task = pdfjs.getDocument({ url });
        destroy = () => void task.destroy();
        const pdf = await task.promise;
        const ratio = window.devicePixelRatio || 1;

        container.replaceChildren();

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          const scale = container.clientWidth / base.width;
          const viewport = page.getViewport({ scale: scale * ratio });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'mb-2 w-full bg-white';
          canvas.setAttribute('aria-label', `${title}, page ${n}`);
          container.append(canvas);

          await page.render({ canvas, viewport }).promise;
        }
      } catch {
        if (!cancelled) setError('Could not render the PDF');
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url, title]);

  return (
    <>
      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}
      <div ref={containerRef} />
    </>
  );
}
