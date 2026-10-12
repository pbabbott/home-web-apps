'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import { deleteTitleCard } from './lib/actions';
import type { TitleCard } from './lib/video-api';

// Fixed locale/timeZone so server and client render identical text — a
// locale-dependent format (e.g. toLocaleString()) mismatches across the
// SSR/hydration boundary whenever the server and browser timezones differ.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

interface TitleCardTileProps {
  titleCard: TitleCard;
}

export function TitleCardTile({ titleCard }: TitleCardTileProps) {
  const router = useRouter();
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteTitleCard(titleCard.id);
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete title card',
      );
    } finally {
      setDeleting(false);
    }
  }

  const label = titleCard.title ?? 'No title detected';
  const src = titleCard.screenshotBase64
    ? `data:image/jpeg;base64,${titleCard.screenshotBase64}`
    : null;

  return (
    <div className="group relative aspect-video w-56 overflow-hidden bg-neutral-900">
      {src ? (
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="block h-full w-full cursor-pointer"
        >
          <img
            src={src}
            alt={`Screenshot at ${titleCard.timestampSeconds}s for ${label}`}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Typography variant="small" className="text-neutral-500">
            No screenshot
          </Typography>
        </div>
      )}

      {/* Bottom-right overlay — compact, references TransparentPanel's
          "dark" color (bg-neutral-900/80 + text-neutral-50) but with tight
          padding instead of TransparentPanel's px-4 py-2, since this needs
          to stay small against a thumbnail. */}
      <div className="absolute bottom-0 right-0 max-w-full border-l border-t border-primary-500/70 bg-neutral-900/80 px-2 py-1">
        <Typography
          variant="caption"
          className="block max-w-40 truncate text-neutral-50"
        >
          {label}
        </Typography>
        <Typography
          variant="small"
          className="block tabular-nums text-neutral-400"
        >
          T+{titleCard.timestampSeconds}s · {titleCard.runTimeSeconds ?? '—'}s
        </Typography>
      </div>

      <button
        type="button"
        aria-label="Delete title card"
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-neutral-900/70 text-error-400 transition-colors hover:bg-error-600 hover:text-neutral-50"
      >
        <span aria-hidden="true" className="text-xs leading-none">
          ✕
        </span>
      </button>

      <Modal open={detailOpen} onOpenChange={setDetailOpen}>
        <ModalContent color="secondary">
          <ModalTitle>{label}</ModalTitle>
          {src && (
            <img
              src={src}
              alt={`Screenshot at ${titleCard.timestampSeconds}s for ${label}`}
              className="mt-4 w-full"
            />
          )}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <Typography
              variant="small"
              component="span"
              className="text-neutral-400"
            >
              File Path
            </Typography>
            <Typography variant="body2" component="span" className="truncate">
              {titleCard.filePath}
            </Typography>
            <Typography
              variant="small"
              component="span"
              className="text-neutral-400"
            >
              Timestamp
            </Typography>
            <Typography variant="body2" component="span">
              {titleCard.timestampSeconds}s
            </Typography>
            <Typography
              variant="small"
              component="span"
              className="text-neutral-400"
            >
              Runtime
            </Typography>
            <Typography variant="body2" component="span">
              {titleCard.runTimeSeconds ?? '—'}s
            </Typography>
            <Typography
              variant="small"
              component="span"
              className="text-neutral-400"
            >
              Created
            </Typography>
            <Typography variant="body2" component="span">
              {formatDate(titleCard.createdAt)}
            </Typography>
          </dl>
        </ModalContent>
      </Modal>

      <Modal open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ModalContent color="secondary">
          <ModalTitle>Delete this title card?</ModalTitle>
          <ModalDescription>
            Permanently deletes the record for {label} at{' '}
            {titleCard.timestampSeconds}s. The episode becomes eligible for
            title-card detection again on the next job run. This cannot be
            undone.
          </ModalDescription>
          {deleteError && (
            <Typography variant="body2" className="mt-2 text-error-400">
              {deleteError}
            </Typography>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <OutlinedButton
              size="small"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </OutlinedButton>
            <Button
              size="small"
              color="error"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
