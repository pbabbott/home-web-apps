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
import {
  createBackupDestination,
  updateBackupDestination,
} from '../sources/lib/actions';
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
 * Registers an NFS destination, like Add Source does for a machine, or edits
 * `destination` when given. Mount it only while open, so each opening starts
 * from the destination's current values (or empty).
 */
export function AddDestinationModal({
  destination,
  onOpenChange,
  onSaved,
}: {
  destination?: BackupDestination;
  onOpenChange: (open: boolean) => void;
  onSaved: (destination: BackupDestination) => void;
}) {
  const editing = destination !== undefined;
  const [name, setName] = useState(destination?.name ?? '');
  const [server, setServer] = useState(destination?.settings.server ?? '');
  const [exportPath, setExportPath] = useState(
    destination?.settings.exportPath ?? '',
  );
  const [rootDir, setRootDir] = useState(destination?.rootDir ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const input = {
      name: name.trim(),
      server: server.trim(),
      exportPath: exportPath.trim(),
      rootDir: rootDir.trim(),
    };
    const result = destination
      ? await updateBackupDestination(destination.id, input)
      : await createBackupDestination(input);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
    onSaved(result.data);
  }

  return (
    <Modal open onOpenChange={onOpenChange}>
      <ModalContent color="secondary">
        <ModalTitle>
          {editing ? 'Edit Destination' : 'Add Destination'}
        </ModalTitle>
        <ModalDescription>
          {editing
            ? 'The export and folder cannot change while a job is active or anything is already verified here. Validate again afterwards.'
            : 'Register the NFS export Exodus copies to. This is the export’s identity; the backup worker with it mounted claims the destination by itself. Validate it afterwards.'}
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
              {submitting
                ? editing
                  ? 'Saving…'
                  : 'Adding…'
                : editing
                  ? 'Save'
                  : 'Add Destination'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
