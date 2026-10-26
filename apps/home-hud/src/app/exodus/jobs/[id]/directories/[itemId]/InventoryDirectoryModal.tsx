'use client';

import { useState, type FormEvent } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import { inventoryWholeDirectory } from '../../../../sources/lib/actions';

interface InventoryDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueItem: { id: string; path: string };
  /** Called with the number of queued directories skipped, after the API accepted it. */
  onInventoried: (path: string, skippedQueueItems: number) => void;
}

export function InventoryDirectoryModal({
  open,
  onOpenChange,
  queueItem,
  onInventoried,
}: InventoryDirectoryModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setNote('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await inventoryWholeDirectory(
      queueItem.id,
      note.trim() || undefined,
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    resetForm();
    onOpenChange(false);
    onInventoried(queueItem.path, result.data.skippedQueueItems);
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
        <ModalTitle>Inventory Whole Directory</ModalTitle>
        <ModalDescription>
          Approve this directory as one inventory item, so nothing inside it
          needs exploring. The agent&apos;s proposal is approved if there is
          one, otherwise the directory is added. Queued directories inside it in
          this job are skipped; reversing the approval later does not queue them
          again.
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Typography variant="body2" className="break-all">
            {queueItem.path}
          </Typography>

          <label className="flex flex-col gap-1">
            <Typography variant="body2" className="text-neutral-400">
              Note (optional)
            </Typography>
            <Input
              color="primary"
              className="w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="why all of it"
            />
          </label>

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
              {submitting ? 'Adding…' : 'Add to inventory'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
