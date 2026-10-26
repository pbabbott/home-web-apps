'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import { guessKind } from '../../lib/job-display';
import { promoteSkippedPath } from '../../sources/lib/actions';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <Typography variant="body2" className="text-neutral-400">
        {label}
      </Typography>
      {children}
    </label>
  );
}

const KIND_LABELS = { file: 'File', directory: 'Directory' } as const;

interface PromoteSkippedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The directory the path was skipped from. */
  queueItem: { id: string; path: string };
  /** The skipped path to promote; omit to type one in. Remount (via `key`) to switch paths. */
  path?: string;
  /** Why the agent skipped `path`. */
  skipReason?: string;
  onPromoted: (path: string) => void;
}

export function PromoteSkippedModal({
  open,
  onOpenChange,
  queueItem,
  path: fixedPath,
  skipReason,
  onPromoted,
}: PromoteSkippedModalProps) {
  const [path, setPath] = useState(fixedPath ?? '');
  const [kind, setKind] = useState<'file' | 'directory'>(
    fixedPath ? guessKind(fixedPath) : 'file',
  );
  const [kindTouched, setKindTouched] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setPath(fixedPath ?? '');
    setKind(fixedPath ? guessKind(fixedPath) : 'file');
    setKindTouched(false);
    setNote('');
    setError(null);
  }

  function changePath(value: string) {
    setPath(value);
    if (!kindTouched) setKind(guessKind(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const trimmed = path.trim();
    const result = await promoteSkippedPath(queueItem.id, {
      path: trimmed,
      kind,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(skipReason ? { skipReason } : {}),
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    resetForm();
    onOpenChange(false);
    onPromoted(result.data.rootPath);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <ModalContent color="secondary">
        <ModalTitle>Promote to Inventory</ModalTitle>
        <ModalDescription>
          Add a path the agent skipped to the inventory. It is created as
          approved, since promoting is your decision. The agent&apos;s skip
          record is left as it was.
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Field label="Path">
            <Input
              color="primary"
              className="w-full"
              required
              disabled={fixedPath !== undefined}
              value={path}
              onChange={(e) => changePath(e.target.value)}
              placeholder={`${queueItem.path}\\file.ext`}
            />
          </Field>

          {skipReason && (
            <Typography variant="body2" className="text-neutral-400">
              Skipped by the agent: {skipReason}
            </Typography>
          )}

          <Field label="Kind">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <OutlinedButton
                  type="button"
                  size="small"
                  color="primary"
                  className="w-full"
                >
                  {KIND_LABELS[kind]}
                </OutlinedButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent label="Kind">
                {(Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map(
                  (value) => (
                    <DropdownMenuItem
                      key={value}
                      onSelect={() => {
                        setKind(value);
                        setKindTouched(true);
                      }}
                    >
                      {KIND_LABELS[value]}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>

          <Field label="Note (optional)">
            <Input
              color="primary"
              className="w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="why this one matters"
            />
          </Field>

          {error && (
            <Typography variant="body2" className="text-error-400">
              {error}
            </Typography>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <OutlinedButton
              type="button"
              size="small"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </OutlinedButton>
            <Button type="submit" size="small" disabled={submitting}>
              {submitting ? 'Promoting…' : 'Promote'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
