'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
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
import {
  connectionFormOf,
  emptyConnectionForm,
  SourceConnectionFields,
  type ConnectionForm,
} from './SourceConnectionFields';
import {
  createSource,
  deleteSourceConnection,
  getSourceConnection,
  saveSourceConnection,
  testSourceConnection,
  updateSource,
} from './lib/actions';
import type { Source, SourceConnection } from './lib/homelab-api';

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
  const [connectionForm, setConnectionForm] =
    useState<ConnectionForm>(emptyConnectionForm);
  const [savedConnection, setSavedConnection] =
    useState<SourceConnection | null>(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source || !open) return;

    let cancelled = false;
    void getSourceConnection(source.id).then((result) => {
      if (cancelled || !result.ok) return;
      setSavedConnection(result.data);
      setConnectionForm(connectionFormOf(result.data));
    });

    return () => {
      cancelled = true;
    };
  }, [source, open]);

  function resetForm() {
    setName(source?.name ?? '');
    setHostId(source?.hostId ?? '');
    setConnectionForm(connectionFormOf(savedConnection));
    setError(null);
  }

  /** Brings the stored connection in line with the form; returns an error message or null. */
  async function persistConnection(sourceId: string): Promise<string | null> {
    if (connectionForm.type === 'none') {
      if (!savedConnection) return null;

      const result = await deleteSourceConnection(sourceId);

      if (!result.ok) return result.error;
      setSavedConnection(null);
      return null;
    }

    const result = await saveSourceConnection(sourceId, {
      connectionType: connectionForm.type,
      username: connectionForm.username.trim(),
      domain: connectionForm.domain.trim() || null,
      password: connectionForm.password || undefined,
      shareMappings: connectionForm.shareMappings
        .map((m) => ({
          pathPrefix: m.pathPrefix.trim(),
          share: m.share.trim(),
        }))
        .filter((m) => m.pathPrefix && m.share),
    });

    if (!result.ok) return result.error;
    setSavedConnection(result.data);
    setConnectionForm((form) => ({ ...form, password: '' }));
    return null;
  }

  async function handleTest() {
    if (!source) return;
    setTesting(true);
    setError(null);

    const saveError = await persistConnection(source.id);
    const result = saveError ? null : await testSourceConnection(source.id);
    setTesting(false);

    if (saveError) setError(saveError);
    else if (result && !result.ok) setError(result.error);
    else if (result?.ok) setSavedConnection(result.data);
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

    if (!result.ok) {
      setSubmitting(false);
      setError(result.error);
      return;
    }

    const connectionError = await persistConnection(result.data.id);
    setSubmitting(false);

    if (connectionError) {
      // The source itself is saved; keep the modal open so the connection can be fixed.
      setError(`Source saved, but its connection was not: ${connectionError}`);
      onSaved();
      return;
    }

    if (!editing) {
      // The modal is reused for the next new source.
      setName('');
      setHostId('');
      setConnectionForm(emptyConnectionForm);
      setSavedConnection(null);
      setError(null);
    }
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
            ? 'Rename the source, change the host it is linked to, or set how its files are reached for previews. Its jobs and inventory items stay with it.'
            : 'Register a machine to explore for the exodus migration. Link it to a host registered under Infra / Hosts, or leave it unlinked.'}
        </ModalDescription>

        <form
          onSubmit={handleSubmit}
          className="mt-4 flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
        >
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

          <SourceConnectionFields
            form={connectionForm}
            onChange={setConnectionForm}
            saved={savedConnection}
            disabled={!editing || submitting}
            testing={testing}
            onTest={() => void handleTest()}
          />

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
