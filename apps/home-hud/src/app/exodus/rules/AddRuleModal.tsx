'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import { createExclusionRule } from '../sources/lib/actions';
import type { ExclusionRuleScope } from '../sources/lib/homelab-api';

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

const SCOPE_LABELS: Record<ExclusionRuleScope, string> = {
  exclude_subtree: 'Exclude subtree: skip it and everything beneath it',
  selective_only:
    'Selective only: not a backup unit itself, still explore inside',
};

interface AddRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: { id: string; name: string }[];
  onCreated: () => void;
}

export function AddRuleModal({
  open,
  onOpenChange,
  sources,
  onCreated,
}: AddRuleModalProps) {
  const [sourceId, setSourceId] = useState('');
  const [path, setPath] = useState('');
  const [scope, setScope] = useState<ExclusionRuleScope>('exclude_subtree');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setSourceId('');
    setPath('');
    setScope('exclude_subtree');
    setReason('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createExclusionRule({
      sourceId: sourceId || undefined,
      path: path.trim(),
      scope,
      reason: reason.trim() || undefined,
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
        <ModalTitle>Add Exclusion Rule</ModalTitle>
        <ModalDescription>
          Stop discovery from going into a path, or from recommending it. Adding
          a rule never deletes anything already recorded.
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Field label="Applies to">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <OutlinedButton
                  type="button"
                  size="small"
                  color="primary"
                  className="w-full"
                >
                  {sources.find((source) => source.id === sourceId)?.name ??
                    'All sources (global)'}
                </OutlinedButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent label="Applies to">
                <DropdownMenuItem onSelect={() => setSourceId('')}>
                  All sources (global)
                </DropdownMenuItem>
                {sources.map((source) => (
                  <DropdownMenuItem
                    key={source.id}
                    onSelect={() => setSourceId(source.id)}
                  >
                    {source.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>

          <Field label="Path">
            <Input
              color="primary"
              className="w-full"
              required
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="C:\Users\You\node_modules"
            />
          </Field>

          <Field label="Scope">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <OutlinedButton
                  type="button"
                  size="small"
                  color="primary"
                  className="w-full"
                >
                  {SCOPE_LABELS[scope]}
                </OutlinedButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent label="Scope">
                {(Object.keys(SCOPE_LABELS) as ExclusionRuleScope[]).map(
                  (value) => (
                    <DropdownMenuItem
                      key={value}
                      onSelect={() => setScope(value)}
                    >
                      {SCOPE_LABELS[value]}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>

          <Field label="Reason (optional)">
            <Input
              color="primary"
              className="w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="generated build output"
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
              {submitting ? 'Adding…' : 'Add Rule'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
