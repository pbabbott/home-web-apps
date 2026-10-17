'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  ModalTrigger,
  OutlinedButton,
  Switch,
  Typography,
} from '@abbottland/fui-components';
import { deleteHost, updateHost } from './lib/actions';
import type { ExporterType, Host, HostType } from './lib/homelab-api';
import { ExporterSelectField } from './ExporterSelectField';
import { ModelSelectField } from './ModelSelectField';

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

interface EditHostModalProps {
  host: Host;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function EditHostModal({
  host,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: EditHostModalProps) {
  const [name, setName] = useState(host.name);
  const [ipAddress, setIpAddress] = useState(host.ipAddress);
  const [instance, setInstance] = useState(host.instance ?? '');
  const [hostType, setHostType] = useState<HostType>(host.hostType);
  const [exporterType, setExporterType] = useState<ExporterType>(
    host.exporterType,
  );
  const [model3d, setModel3d] = useState(host.model3d ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(host.name);
    setIpAddress(host.ipAddress);
    setInstance(host.instance ?? '');
    setHostType(host.hostType);
    setExporterType(host.exporterType);
    setModel3d(host.model3d ?? '');
    setError(null);
    setConfirmDeleteOpen(false);
    setDeleteError(null);
  }, [open, host]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await updateHost(host.id, {
        name,
        ipAddress,
        hostType,
        exporterType,
        instance: instance.trim() ? instance.trim() : null,
        model3d: model3d ? model3d : null,
      });
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update host');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteHost(host.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete host',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent color="secondary">
        <ModalTitle>Edit Host</ModalTitle>
        <ModalDescription>
          Update this host&apos;s details. Set instance to match it against
          Prometheus exporter data.
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Field label="Name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="tf-prod-k8s-worker-1"
            />
          </Field>

          <Field label="IP Address">
            <Input
              required
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="10.0.0.11"
            />
          </Field>

          <Field label="Instance (Prometheus, optional)">
            <Input
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              placeholder="192.168.6.24:9100"
            />
          </Field>

          <Field label="Metrics Exporter">
            <ExporterSelectField
              value={exporterType}
              onChange={setExporterType}
            />
          </Field>

          <div className="flex items-center gap-3">
            <Typography variant="small" className="text-neutral-400">
              Physical
            </Typography>
            <Switch
              checked={hostType === 'virtual'}
              onCheckedChange={(checked) =>
                setHostType(checked ? 'virtual' : 'physical')
              }
            />
            <Typography variant="small" className="text-neutral-400">
              Virtual
            </Typography>
          </div>

          <Field label="3D Model (optional)">
            <ModelSelectField value={model3d} onChange={setModel3d} />
          </Field>

          {error && (
            <Typography variant="body2" className="text-error-400">
              {error}
            </Typography>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            <Modal open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
              <ModalTrigger asChild>
                <Button
                  type="button"
                  size="small"
                  color="error"
                  disabled={submitting}
                >
                  Delete
                </Button>
              </ModalTrigger>
              <ModalContent color="secondary">
                <ModalTitle>Delete {host.name}?</ModalTitle>
                <ModalDescription>
                  Permanently removes this host. This cannot be undone.
                </ModalDescription>
                {deleteError && (
                  <Typography variant="body2" className="text-error-400">
                    {deleteError}
                  </Typography>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <OutlinedButton
                    type="button"
                    size="small"
                    disabled={deleting}
                    onClick={() => setConfirmDeleteOpen(false)}
                  >
                    Cancel
                  </OutlinedButton>
                  <Button
                    type="button"
                    size="small"
                    color="error"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </ModalContent>
            </Modal>

            <div className="flex justify-end gap-3">
              <OutlinedButton
                type="button"
                size="small"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </OutlinedButton>
              <Button type="submit" size="small" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
