'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  OutlinedButton,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import {
  canPromoteCheckedPath,
  COVERAGE_STATUS_COLOR,
  COVERAGE_STATUS_DESCRIPTIONS,
  COVERAGE_STATUS_LABELS,
  DECISION_LABELS,
  inventoryItemUrl,
} from '../lib/inventory-display';
import { PromoteSkippedModal } from '../lib/PromoteSkippedModal';
import { checkPathCoverage } from '../sources/lib/actions';
import type {
  NestedInventoryItem,
  PathCoverage,
} from '../sources/lib/homelab-api';

interface PathCoverageCheckProps {
  sourceId: string;
}

/** Asks whether a path, at any depth, rolls up to an inventory item of the source. */
export function PathCoverageCheck({ sourceId }: PathCoverageCheckProps) {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<PathCoverage | null>(null);
  const [promoting, setPromoting] = useState(false);

  async function run(target: string) {
    setChecking(true);
    setError(null);

    const result = await checkPathCoverage(sourceId, target);
    setChecking(false);

    if (!result.ok) {
      setCoverage(null);
      setError(result.error);
      return;
    }

    setCoverage(result.data);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const target = path.trim();

    if (target) void run(target);
  }

  const itemLink = (item: NestedInventoryItem) => (
    <Link
      href={inventoryItemUrl(sourceId, item.rootPath)}
      className="break-all text-primary-400 hover:underline"
    >
      {item.rootPath}
    </Link>
  );

  const itemRow = (item: NestedInventoryItem) => (
    <li key={item.id} className="flex flex-wrap items-baseline gap-2">
      <Typography variant="body2" component="span">
        {itemLink(item)}
      </Typography>
      <Typography variant="small" component="span" className="text-neutral-400">
        {DECISION_LABELS[item.decision]}
      </Typography>
    </li>
  );

  return (
    <TransparentPanel color="dark" className="flex flex-col gap-4 py-4">
      <Typography variant="body2" className="text-neutral-400">
        Paste a path from anywhere in the filesystem to see whether it rolls up
        to an inventory item.
      </Typography>

      <form
        role="search"
        onSubmit={submit}
        className="flex w-full flex-wrap items-center gap-2"
      >
        <Input
          color="primary"
          className="w-full sm:w-[32rem]"
          placeholder="C:\Users\You\AppData\Roaming\App\saves"
          aria-label="Path to check"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <Button type="submit" disabled={checking || !path.trim()}>
          {checking ? 'Checking…' : 'Check'}
        </Button>
      </form>

      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}

      {coverage && (
        <div className="flex flex-col gap-3 border-t border-neutral-700 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={COVERAGE_STATUS_COLOR[coverage.status]}>
              {COVERAGE_STATUS_LABELS[coverage.status]}
            </Badge>
            <Typography variant="body2" className="break-all">
              {coverage.path}
            </Typography>
          </div>
          <Typography variant="body2" className="text-neutral-400">
            {COVERAGE_STATUS_DESCRIPTIONS[coverage.status]}
          </Typography>

          {coverage.exact && (
            <div className="flex flex-col gap-1">
              <Typography variant="small" className="text-neutral-400">
                Inventory item at this path
              </Typography>
              <ul className="flex flex-col gap-1">{itemRow(coverage.exact)}</ul>
            </div>
          )}

          {coverage.coveredBy.length > 0 && (
            <div className="flex flex-col gap-1">
              <Typography variant="small" className="text-neutral-400">
                Inventory items above it
              </Typography>
              <ul className="flex flex-col gap-1">
                {coverage.coveredBy.map(itemRow)}
              </ul>
            </div>
          )}

          {coverage.covers.length > 0 && (
            <div className="flex flex-col gap-1">
              <Typography variant="small" className="text-neutral-400">
                Inventory items beneath it
              </Typography>
              <ul className="flex flex-col gap-1">
                {coverage.covers.map(itemRow)}
              </ul>
            </div>
          )}

          {coverage.exclusion.state !== 'none' && (
            <Typography variant="body2" className="text-warning-400">
              {coverage.exclusion.state === 'excluded'
                ? 'An exclusion rule excludes this path, so it cannot be approved.'
                : 'A selective-only rule is on this exact path, so it cannot be an inventory item itself.'}{' '}
              <Link
                href="/exodus/rules"
                className="text-primary-400 hover:underline"
              >
                View rules
              </Link>
            </Typography>
          )}

          {coverage.skip && (
            <Typography variant="body2" className="text-neutral-400">
              The agent skipped{' '}
              {coverage.skip.pattern
                ? `${coverage.skip.pattern} in ${coverage.skip.path}`
                : coverage.skip.path}
              : {coverage.skip.reason}{' '}
              <Link
                href={`/exodus/jobs/${coverage.skip.jobId}`}
                className="text-primary-400 hover:underline"
              >
                View job
              </Link>
            </Typography>
          )}

          {coverage.visitedDirectory ? (
            <div className="flex flex-wrap items-center gap-2">
              <Typography variant="body2" className="text-neutral-400">
                Deepest directory a job visited:
              </Typography>
              <Typography variant="body2" className="break-all">
                {coverage.visitedDirectory.path}
              </Typography>
              <OutlinedButton
                component={Link}
                href={`/exodus/jobs/${coverage.visitedDirectory.jobId}/directories/${coverage.visitedDirectory.id}`}
                color="accent-falcon"
                size="small"
              >
                View directory →
              </OutlinedButton>
              {canPromoteCheckedPath(coverage) && (
                <Button size="small" onClick={() => setPromoting(true)}>
                  Promote to inventory
                </Button>
              )}
            </div>
          ) : (
            coverage.status === 'uncovered' && (
              <Typography variant="body2" className="text-neutral-400">
                No job has visited this path or any directory above it.
              </Typography>
            )
          )}
        </div>
      )}

      {coverage?.visitedDirectory && canPromoteCheckedPath(coverage) && (
        <PromoteSkippedModal
          key={coverage.normalizedPath}
          open={promoting}
          onOpenChange={setPromoting}
          queueItem={coverage.visitedDirectory}
          path={coverage.path}
          skipReason={coverage.skip?.reason}
          onPromoted={() => {
            void run(coverage.path);
            router.refresh();
          }}
        />
      )}
    </TransparentPanel>
  );
}
