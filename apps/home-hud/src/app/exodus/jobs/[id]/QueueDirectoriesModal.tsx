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
import { parsePathLines } from '../../lib/job-display';
import { enqueueQueueItems } from '../../sources/lib/actions';

interface QueueDirectoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  rootPath: string;
  onQueued: () => void;
}

export function QueueDirectoriesModal({
  open,
  onOpenChange,
  jobId,
  rootPath,
  onQueued,
}: QueueDirectoriesModalProps) {
  const [paths, setPaths] = useState('');
  const [priority, setPriority] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function resetForm() {
    setPaths('');
    setPriority('');
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await enqueueQueueItems(
      jobId,
      parsePathLines(paths),
      priority.trim() === '' ? undefined : Number(priority),
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const created = result.data.filter((r) => r.created).length;
    const already = result.data.length - created;
    setMessage(
      `Queued ${created} ${created === 1 ? 'directory' : 'directories'}` +
        (already > 0 ? `, ${already} already in this job` : ''),
    );
    setPaths('');
    onQueued();
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
        <ModalTitle>Queue Directories</ModalTitle>
        <ModalDescription>
          Point the agent at more places inside this job&apos;s root ({rootPath}
          ). One path per line. Paths under an exclusion rule are skipped
          immediately.
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <Typography variant="body2" className="text-neutral-400">
              Paths
            </Typography>
            <textarea
              required
              rows={4}
              value={paths}
              onChange={(e) => setPaths(e.target.value)}
              placeholder={`${rootPath}\\Archive`}
              className="border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0"
            />
          </label>
          <label className="flex flex-col gap-1 sm:w-48">
            <Typography variant="body2" className="text-neutral-400">
              Priority (optional, higher first)
            </Typography>
            <Input
              color="primary"
              type="number"
              step={1}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="0"
            />
          </label>

          {error && (
            <Typography variant="body2" className="text-error-400">
              {error}
            </Typography>
          )}
          {message && (
            <Typography variant="body2" role="status">
              {message}
            </Typography>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <OutlinedButton
              type="button"
              size="small"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Close
            </OutlinedButton>
            <Button
              type="submit"
              size="small"
              disabled={submitting || parsePathLines(paths).length === 0}
            >
              {submitting ? 'Queueing…' : 'Queue'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
