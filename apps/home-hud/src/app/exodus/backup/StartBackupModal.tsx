'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import { formatSize } from '../lib/inventory-display';
import { planWarningText } from '../lib/backup-display';
import { createBackupJob, planBackupJob } from '../sources/lib/actions';
import type { BackupPlan } from '../sources/lib/homelab-api';

/**
 * "Start backup job": mount it only while open, so each opening plans afresh.
 * It plans as soon as it mounts (a dry run that writes
 * nothing), shows the numbers, and creates the job on confirm.
 */
export function StartBackupModal({
  open,
  onOpenChange,
  sourceId,
  destinationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  destinationId: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<BackupPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void planBackupJob(sourceId, destinationId).then((result) => {
      if (cancelled) return;
      if (result.ok) setPlan(result.data);
      else setError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [sourceId, destinationId]);

  async function create() {
    setCreating(true);
    setError(null);
    const result = await createBackupJob(sourceId, destinationId);
    setCreating(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
    router.push(`/exodus/backup/${result.data.id}`);
  }

  const rows: [string, string][] = plan
    ? [
        ['Items to copy', String(plan.summary.toCopy)],
        [
          'Estimated size',
          plan.summary.toCopy === 0
            ? '—'
            : `${formatSize(plan.summary.estimatedBytes)}${plan.summary.unestimatedItems > 0 ? ' or more' : ''}`,
        ],
        [
          'Items without a size estimate',
          String(plan.summary.unestimatedItems),
        ],
        ['Excluded by a rule', String(plan.summary.excluded)],
        [
          'Already on the destination',
          String(plan.summary.skippedAlreadyCovered),
        ],
        [
          'Inside another approved folder',
          String(plan.summary.skippedRedundantNested),
        ],
        ['Not eligible (not approved)', String(plan.summary.notEligible)],
      ]
    : [];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent color="secondary">
        <ModalTitle>Start backup job</ModalTitle>
        <ModalDescription>
          Copies the approved inventory to the destination. The scope is fixed
          when the job is created; later approvals need a new job.
        </ModalDescription>

        <div className="mt-4 flex flex-col gap-3">
          {!plan && !error && (
            <Typography variant="body2" className="text-neutral-400">
              Planning…
            </Typography>
          )}

          {plan && (
            <>
              <Typography variant="body2">
                Destination folder: {plan.sourceDirName}
              </Typography>
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <Typography variant="body2" className="text-neutral-400">
                    {label}
                  </Typography>
                  <Typography variant="body2">{value}</Typography>
                </div>
              ))}
              {plan.warnings.map((warning) => (
                <Typography
                  key={warning.code}
                  variant="body2"
                  className="text-warning-400"
                >
                  {planWarningText(warning)}
                </Typography>
              ))}
            </>
          )}

          {error && (
            <Typography variant="body2" className="text-error-400">
              {error}
            </Typography>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <OutlinedButton
            type="button"
            size="small"
            disabled={creating}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </OutlinedButton>
          <Button
            type="button"
            size="small"
            disabled={creating || !plan || plan.summary.toCopy === 0}
            onClick={() => void create()}
          >
            {creating ? 'Creating…' : 'Create job'}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
