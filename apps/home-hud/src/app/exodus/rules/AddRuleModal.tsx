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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Typography,
} from '@abbottland/fui-components';
import {
  createExclusionRule,
  updateExclusionRule,
} from '../sources/lib/actions';
import type {
  ExclusionRule,
  ExclusionRuleScope,
} from '../sources/lib/homelab-api';

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

// Radix Select rejects an empty item value, so "all sources" uses a sentinel.
const ALL_SOURCES = '__all__';

const SCOPE_LABELS: Record<ExclusionRuleScope, string> = {
  exclude_subtree: 'Exclude subtree: skip it and everything beneath it',
  selective_only:
    'Selective only: not a backup unit itself, still explore inside',
};

interface AddRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: { id: string; name: string }[];
  /**
   * The rule to edit. Only scope and reason can change: the path and what the
   * rule applies to are fixed. Remount (via `key`) to switch rules.
   */
  rule?: ExclusionRule | null;
  onSaved: () => void;
}

export function AddRuleModal({
  open,
  onOpenChange,
  sources,
  rule = null,
  onSaved,
}: AddRuleModalProps) {
  const editing = rule !== null;
  const [sourceId, setSourceId] = useState(rule?.sourceId ?? '');
  const [path, setPath] = useState(rule?.path ?? '');
  const [scope, setScope] = useState<ExclusionRuleScope>(
    rule?.scope ?? 'exclude_subtree',
  );
  const [reason, setReason] = useState(rule?.reason ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setSourceId(rule?.sourceId ?? '');
    setPath(rule?.path ?? '');
    setScope(rule?.scope ?? 'exclude_subtree');
    setReason(rule?.reason ?? '');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = rule
      ? await updateExclusionRule(rule.id, {
          scope,
          reason: reason.trim() || null,
        })
      : await createExclusionRule({
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
        <ModalTitle>
          {editing ? 'Edit Exclusion Rule' : 'Add Exclusion Rule'}
        </ModalTitle>
        <ModalDescription>
          {editing
            ? 'Change the scope or reason. The path and what the rule applies to are fixed: remove the rule and add a new one to change them. Inventory items already recorded are not touched.'
            : 'Stop discovery from going into a path, or from recommending it. Adding a rule never deletes anything already recorded.'}
        </ModalDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Field label="Applies to">
            <Select
              disabled={editing}
              value={
                sources.some((source) => source.id === sourceId)
                  ? sourceId
                  : ALL_SOURCES
              }
              onValueChange={(value) =>
                setSourceId(value === ALL_SOURCES ? '' : value)
              }
            >
              <SelectTrigger
                aria-label="Applies to"
                size="small"
                className="w-full"
              />
              <SelectContent label="Applies to">
                <SelectItem value={ALL_SOURCES}>
                  All sources (global)
                </SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Path">
            <Input
              color="primary"
              className="w-full"
              required
              disabled={editing}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="C:\Users\You\node_modules"
            />
          </Field>

          <Field label="Scope">
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as ExclusionRuleScope)}
            >
              <SelectTrigger
                aria-label="Scope"
                size="small"
                className="w-full"
              />
              <SelectContent label="Scope">
                {(Object.keys(SCOPE_LABELS) as ExclusionRuleScope[]).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {SCOPE_LABELS[value]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
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
              {submitting
                ? editing
                  ? 'Saving…'
                  : 'Adding…'
                : editing
                  ? 'Save'
                  : 'Add Rule'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
