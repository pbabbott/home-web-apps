'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import { formatSize } from './inventory-display';
import { PdfViewer } from './PdfViewer';
import { previewKind, previewUrl, type ZipListing } from './preview';

type Loaded =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'text'; text: string; truncated: boolean }
  | { status: 'zip'; listing: ZipListing }
  | { status: 'blob'; url: string };

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  path: string;
}

/** Fetches the file through the preview proxy and shows it as an image, PDF (pdf.js), text or a zip's entry list. */
export function FilePreviewModal({
  open,
  onOpenChange,
  sourceId,
  path,
}: FilePreviewModalProps) {
  const kind = previewKind(path);
  const key = `${sourceId}:${path}`;
  const [result, setResult] = useState<{ key: string; value: Loaded } | null>(
    null,
  );
  // A result for a previous file reads as loading until the new fetch lands.
  const loaded: Loaded =
    result?.key === key ? result.value : { status: 'loading' };

  useEffect(() => {
    if (!open || !kind) return;

    const controller = new AbortController();
    let objectUrl: string | null = null;

    const setLoaded = (value: Loaded) => setResult({ key, value });

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

        if (kind === 'zip') {
          setLoaded({
            status: 'zip',
            listing: (await res.json()) as ZipListing,
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
  }, [open, kind, sourceId, path, key]);

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
              <Typography
                variant="body2"
                component="div"
                className="whitespace-pre-wrap break-all"
              >
                {loaded.text}
              </Typography>
              {loaded.truncated && (
                <Typography variant="body2" className="mt-2 text-neutral-400">
                  Showing the first part of a larger file.
                </Typography>
              )}
            </>
          )}
          {loaded.status === 'zip' && (
            <>
              <Typography variant="body2" className="mb-2 text-neutral-400">
                {loaded.listing.total} entries ·{' '}
                {formatSize(loaded.listing.totalSize)} uncompressed
                {loaded.listing.truncated &&
                  ` · showing the first ${loaded.listing.entries.length}`}
              </Typography>
              {loaded.listing.entries.length > 0 && (
                <ScrollableTable className="mb-0">
                  <Table size="small" color="secondary">
                    <TableHead>
                      <TableRow>
                        <Th color="secondary">Name</Th>
                        <Th color="secondary">Size</Th>
                        <Th color="secondary">Modified</Th>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loaded.listing.entries.map((entry) => (
                        <TableRow key={entry.path}>
                          <Td color="secondary" className="break-all">
                            {entry.path}
                            {entry.encrypted && (
                              <span className="ml-2 text-neutral-400">
                                (encrypted)
                              </span>
                            )}
                          </Td>
                          <Td
                            color="secondary"
                            className="whitespace-nowrap text-neutral-400"
                          >
                            {entry.isDirectory ? '—' : formatSize(entry.size)}
                          </Td>
                          <Td
                            color="secondary"
                            className="whitespace-nowrap text-neutral-400"
                          >
                            {entry.modifiedAt?.replace('T', ' ') ?? '—'}
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTable>
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
            <PdfViewer url={loaded.url} title={path} />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
