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
import { createSource } from './lib/actions';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <Typography variant="small" className="text-neutral-400">
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
  onCreated: () => void;
}

export function AddSourceModal({
  open,
  onOpenChange,
  hosts,
  onCreated,
}: AddSourceModalProps) {
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setHostId('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createSource({
      name: name.trim(),
      hostId: hostId || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    resetForm();
    onOpenChange(false);
    onCreated();
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
        <ModalTitle>Add Source</ModalTitle>
        <ModalDescription>
          Register a machine to explore for the exodus migration. Link it to a
          host registered under Infra / Hosts, or leave it unlinked.
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
              {submitting ? 'Adding…' : 'Add Source'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
