'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  Typography,
} from '@abbottland/fui-components';
import { previewKind, previewUrl } from './preview';

type Loaded =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'text'; text: string; truncated: boolean }
  | { status: 'blob'; url: string };

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  path: string;
}

/** Fetches the file through the preview proxy and shows it as an image, PDF or text. */
export function FilePreviewModal({
  open,
  onOpenChange,
  sourceId,
  path,
}: FilePreviewModalProps) {
  const kind = previewKind(path);
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    if (!open || !kind) return;

    const controller = new AbortController();
    let objectUrl: string | null = null;

    setLoaded({ status: 'loading' });

    // fetch, not <img src>: a failed preview needs its message shown, which an
    // img/iframe cannot report.
    void (async () => {
      try {
        const res = await fetch(previewUrl(sourceId, path), {
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          setLoaded({
            status: 'error',
            message: body?.message ?? `Preview failed (${res.status})`,
          });
          return;
        }

        if (kind === 'text') {
          setLoaded({
            status: 'text',
            text: await res.text(),
            truncated: res.headers.get('x-preview-truncated') === 'true',
          });
          return;
        }

        objectUrl = URL.createObjectURL(await res.blob());
        setLoaded({ status: 'blob', url: objectUrl });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setLoaded({ status: 'error', message: 'Could not load the preview' });
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, kind, sourceId, path]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent color="secondary" className="max-w-5xl">
        <ModalTitle>Preview</ModalTitle>
        <ModalDescription className="break-all">{path}</ModalDescription>

        <div className="mt-4 flex max-h-[70vh] min-h-40 flex-col overflow-auto">
          {loaded.status === 'loading' && (
            <Typography variant="body2" className="text-neutral-400">
              Loading…
            </Typography>
          )}
          {loaded.status === 'error' && (
            <Typography variant="body2" className="text-error-400">
              {loaded.message}
            </Typography>
          )}
          {loaded.status === 'text' && (
            <>
              <pre className="whitespace-pre-wrap break-all text-sm">
                {loaded.text}
              </pre>
              {loaded.truncated && (
                <Typography variant="body2" className="mt-2 text-neutral-400">
                  Showing the first part of a larger file.
                </Typography>
              )}
            </>
          )}
          {loaded.status === 'blob' && kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element -- a blob URL, not optimizable
            <img
              src={loaded.url}
              alt={path}
              className="mx-auto max-h-[70vh] max-w-full object-contain"
            />
          )}
          {loaded.status === 'blob' && kind === 'pdf' && (
            <iframe src={loaded.url} title={path} className="h-[70vh] w-full" />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
