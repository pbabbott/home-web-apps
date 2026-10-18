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
  Switch,
  Typography,
} from '@abbottland/fui-components';
import { createHost } from './lib/actions';
import type { ExporterType, HostType } from './lib/homelab-api';
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

interface AddHostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultHostType: HostType;
  onCreated: () => void;
}

export function AddHostModal({
  open,
  onOpenChange,
  defaultHostType,
  onCreated,
}: AddHostModalProps) {
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [instance, setInstance] = useState('');
  const [hostType, setHostType] = useState<HostType>(defaultHostType);
  const [exporterType, setExporterType] =
    useState<ExporterType>('node_exporter');
  const [model3d, setModel3d] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setIpAddress('');
    setInstance('');
    setHostType(defaultHostType);
    setExporterType('node_exporter');
    setModel3d('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createHost({
        name,
        ipAddress,
        hostType,
        exporterType,
        instance: instance.trim() ? instance.trim() : undefined,
        model3d: model3d ? model3d : undefined,
      });
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create host');
    } finally {
      setSubmitting(false);
    }
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
        <ModalTitle>Add Host</ModalTitle>
        <ModalDescription>
          Register a new host. Set instance to match it against Prometheus
          exporter data.
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
              {submitting ? 'Adding…' : 'Add Host'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
