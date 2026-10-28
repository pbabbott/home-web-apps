'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
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
import { createBackupDestination } from '../sources/lib/actions';
import type { BackupDestination } from '../sources/lib/homelab-api';

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

/**
 * Registers an NFS destination, like Add Source does for a machine. Mount it
 * only while open, so each opening starts with an empty form.
 */
export function AddDestinationModal({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: (destination: BackupDestination) => void;
}) {
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [exportPath, setExportPath] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createBackupDestination({
      name: name.trim(),
      server: server.trim(),
      exportPath: exportPath.trim(),
      rootDir: rootDir.trim(),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
    onCreated(result.data);
  }

  return (
    <Modal open onOpenChange={onOpenChange}>
      <ModalContent color="secondary">
        <ModalTitle>Add Destination</ModalTitle>
        <ModalDescription>
          Register the NFS export Exodus copies to. This is the export’s
          identity; the backup worker for it must have it mounted and be given
          this destination’s id. Validate it afterwards.
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Field label="Name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dump"
            />
          </Field>

          <Field label="NFS server">
            <Input
              required
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="192.168.4.124"
            />
          </Field>

          <Field label="Export path">
            <Input
              required
              value={exportPath}
              onChange={(e) => setExportPath(e.target.value)}
              placeholder="/volume1/Dump"
            />
          </Field>

          <Field label="Folder under the export (optional)">
            <Input
              value={rootDir}
              onChange={(e) => setRootDir(e.target.value)}
              placeholder="blank writes at the export’s root"
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
            <Button
              type="submit"
              size="small"
              disabled={
                submitting ||
                !name.trim() ||
                !server.trim() ||
                !exportPath.trim()
              }
            >
              {submitting ? 'Adding…' : 'Add Destination'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
