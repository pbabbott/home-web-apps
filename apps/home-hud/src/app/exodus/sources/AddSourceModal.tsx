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
import type { Host } from '../../infra/hosts/lib/homelab-api';
import { HostSelectField } from './HostSelectField';
import { createSource, updateSource } from './lib/actions';
import type { Source } from './lib/homelab-api';

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

interface AddSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hosts: Host[];
  /** The source to edit. Remount (via `key`) to switch sources. */
  source?: Source | null;
  /** Called after a source is created or edited. */
  onSaved: () => void;
}

export function AddSourceModal({
  open,
  onOpenChange,
  hosts,
  source = null,
  onSaved,
}: AddSourceModalProps) {
  const editing = source !== null;
  const [name, setName] = useState(source?.name ?? '');
  const [hostId, setHostId] = useState(source?.hostId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName(source?.name ?? '');
    setHostId(source?.hostId ?? '');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = source
      ? await updateSource(source.id, {
          name: name.trim(),
          hostId: hostId || null,
        })
      : await createSource({
          name: name.trim(),
          hostId: hostId || undefined,
        });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (!editing) resetForm();
    onOpenChange(false);
    onSaved();
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
        <ModalTitle>{editing ? 'Edit Source' : 'Add Source'}</ModalTitle>
        <ModalDescription>
          {editing
            ? 'Rename the source or change the host it is linked to. Its jobs and inventory items stay with it.'
            : 'Register a machine to explore for the exodus migration. Link it to a host registered under Infra / Hosts, or leave it unlinked.'}
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Field label="Name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="win11-desktop"
            />
          </Field>

          <Field label="Host (optional)">
            <HostSelectField
              hosts={hosts}
              value={hostId}
              onChange={setHostId}
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
              {submitting
                ? editing
                  ? 'Saving…'
                  : 'Adding…'
                : editing
                  ? 'Save'
                  : 'Add Source'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
