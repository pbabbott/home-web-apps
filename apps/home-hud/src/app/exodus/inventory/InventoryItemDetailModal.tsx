'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
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
  changedSinceDecision,
  DECISION_COLOR,
  DECISION_LABELS,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
} from '../lib/inventory-display';
import {
  decideInventoryItem,
  getInventoryItemDetail,
} from '../sources/lib/actions';
import type {
  ExclusionState,
  InventoryItemDecision,
  InventoryItem,
} from '../sources/lib/homelab-api';
import { InventoryItemDetails } from './InventoryItemDetails';

interface InventoryItemDetailModalProps {
  /** The inventory item to review; null closes the modal. */
  inventoryItem: InventoryItem | null;
  onClose: () => void;
  onDecided: () => void;
}

export function InventoryItemDetailModal({
  inventoryItem,
  onClose,
  onDecided,
}: InventoryItemDetailModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keyed by item id so a stale answer for a previous item is ignored.
  const [exclusionResult, setExclusionResult] = useState<{
    itemId: string;
    state: ExclusionState | null;
    error: string | null;
  } | null>(null);

  // The list rows don't say how exclusion rules treat a path, so ask the API
  // once the modal opens; it refuses to approve an excluded path anyway.
  const itemId = inventoryItem?.id;
  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;
    void getInventoryItemDetail(itemId).then((result) => {
      if (cancelled) return;

      setExclusionResult(
        result.ok
          ? { itemId, state: result.data.exclusion.state, error: null }
          : { itemId, state: null, error: result.error },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const currentExclusion =
    exclusionResult?.itemId === itemId ? exclusionResult : null;
  const exclusion = currentExclusion?.state ?? null;
  const exclusionError = currentExclusion?.error ?? null;

  function close() {
    setNote('');
    setError(null);
    onClose();
  }

  async function decide(decision: InventoryItemDecision) {
    if (!inventoryItem) return;

    setSubmitting(true);
    setError(null);

    // An empty box leaves the note out, so the API keeps or clears it by its own rule.
    const result = await decideInventoryItem(
      inventoryItem.id,
      decision,
      note.trim() || undefined,
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNote('');
    onDecided();
  }

  return (
    <Modal
      open={inventoryItem !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <ModalContent color="secondary" className="max-w-4xl">
        <ModalTitle>{inventoryItem?.displayName}</ModalTitle>
        <ModalDescription className="break-all">
          {inventoryItem?.rootPath}
        </ModalDescription>

        {inventoryItem && (
          <div className="mt-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                color={inventoryItem.kind === 'file' ? 'dark' : 'secondary'}
              >
                {inventoryItem.kind === 'file' ? 'file' : 'folder'}
              </Badge>
              <Badge color={RECOMMENDATION_COLOR[inventoryItem.recommendation]}>
                Agent: {RECOMMENDATION_LABELS[inventoryItem.recommendation]} (
                {inventoryItem.confidence})
              </Badge>
              <Badge color={DECISION_COLOR[inventoryItem.decision]}>
                {DECISION_LABELS[inventoryItem.decision]}
              </Badge>
              {changedSinceDecision(inventoryItem) && (
                <Badge color="warning">Agent changed its mind</Badge>
              )}
            </div>

            {exclusion && exclusion !== 'none' && (
              <Typography variant="body2" className="text-warning-400">
                {exclusion === 'excluded'
                  ? 'An exclusion rule covers this path, so it cannot be approved. '
                  : 'A selective-only rule marks this exact path as not a backup unit, so it cannot be approved. '}
                <Link
                  href="/exodus/rules"
                  className="text-primary-400 hover:underline"
                >
                  View rules
                </Link>
              </Typography>
            )}
            {exclusionError && (
              <Typography variant="small" className="text-neutral-400">
                Could not check exclusion rules: {exclusionError}
              </Typography>
            )}

            <InventoryItemDetails inventoryItem={inventoryItem} />

            <label className="flex flex-col gap-1">
              <Typography variant="body1" className="text-neutral-400">
                Note (optional)
              </Typography>
              <Input
                color="primary"
                className="w-full"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        )}

        {error && (
          <Typography variant="body2" className="mt-4 text-error-400">
            {error}
          </Typography>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <OutlinedButton size="small" disabled={submitting} onClick={close}>
            Close
          </OutlinedButton>
          {inventoryItem && inventoryItem.decision !== 'pending' && (
            <OutlinedButton
              size="small"
              disabled={submitting}
              onClick={() => decide('pending')}
            >
              Reset to pending
            </OutlinedButton>
          )}
          {inventoryItem?.decision !== 'rejected' && (
            <OutlinedButton
              size="small"
              color="error"
              disabled={submitting}
              onClick={() => decide('rejected')}
            >
              Reject
            </OutlinedButton>
          )}
          {inventoryItem?.decision !== 'approved' && (
            <Button
              size="small"
              disabled={submitting || (exclusion ?? 'none') !== 'none'}
              onClick={() => decide('approved')}
            >
              Approve
            </Button>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
