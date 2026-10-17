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
import { startDiscoveryJob } from '../lib/actions';

interface StartJobModalProps {
  sourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: () => void;
}

export function StartJobModal({
  sourceId,
  open,
  onOpenChange,
  onStarted,
}: StartJobModalProps) {
  const [rootPath, setRootPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setRootPath('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await startDiscoveryJob(sourceId, rootPath.trim());
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    resetForm();
    onOpenChange(false);
    onStarted();
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
        <ModalTitle>Start Discovery Job</ModalTitle>
        <ModalDescription>
          Queues this directory as the starting point. The agent then explores
          everything beneath it, directory by directory.
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <Typography variant="small" className="text-neutral-400">
              Root path
            </Typography>
            <Input
              required
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="C:\Users\You"
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
            <Button
              type="submit"
              size="small"
              disabled={submitting || !rootPath.trim()}
            >
              {submitting ? 'Starting…' : 'Start Job'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
