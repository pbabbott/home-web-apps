'use client';

import { useState } from 'react';
import { Icon } from '@abbottland/fui-icons';
import { FilePreviewModal } from './FilePreviewModal';
import { previewKind } from './preview';

interface PreviewButtonProps {
  sourceId: string;
  path: string;
  className?: string;
}

/** A spyglass that opens the file's preview; renders nothing for types that cannot be previewed. */
export function PreviewButton({
  sourceId,
  path,
  className,
}: PreviewButtonProps) {
  const [open, setOpen] = useState(false);

  if (!previewKind(path)) return null;

  return (
    <>
      <button
        type="button"
        title="Preview"
        aria-label={`Preview ${path}`}
        onClick={() => setOpen(true)}
        className={`inline-flex items-center rounded p-1 text-neutral-400 hover:text-primary-400 ${className ?? ''}`}
      >
        <Icon name="radix-magnifying-glass" title="Preview" />
      </button>
      {open && (
        <FilePreviewModal
          open
          onOpenChange={setOpen}
          sourceId={sourceId}
          path={path}
        />
      )}
    </>
  );
}
