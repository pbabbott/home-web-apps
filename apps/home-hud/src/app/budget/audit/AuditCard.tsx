import {
  Badge,
  Card,
  HorizontalRule,
  Typography,
} from '@abbottland/fui-components';
import Link from 'next/link';
import { LocalDate } from '../lib/LocalDate';
import type { FilterAuditEntry } from '../lib/budget-api';
import { formatUnits } from '../lib/budget-display';
import type { AuditGroup } from './group-audit-entries';

const cardColor = {
  applied: 'success',
  unchanged: 'success',
  skipped_conflict: 'warning',
  failed: 'error',
} as const;

const statusLabel: Record<FilterAuditEntry['status'], string> = {
  applied: 'Applied',
  unchanged: 'Already set',
  skipped_conflict: 'Skipped (conflict)',
  failed: 'Failed',
};

/** One before → after line. A change that did not land is struck through. */
function ChangeLine({
  entry,
  fallbackFrom,
}: {
  entry: FilterAuditEntry;
  fallbackFrom: string;
}) {
  if (entry.status === 'unchanged') {
    return (
      <Typography variant="body1" component="div">
        <strong>{entry.toValue}</strong>
        <span className="text-neutral-400"> (already set in YNAB)</span>
      </Typography>
    );
  }

  const applied = entry.status === 'applied';
  return (
    <div className="flex flex-col gap-0.5">
      <Typography
        variant="body1"
        component="div"
        className={applied ? undefined : 'opacity-60'}
      >
        <span className="text-neutral-400">
          {entry.fromValue ?? fallbackFrom}
        </span>
        {' → '}
        <strong className={applied ? undefined : 'line-through'}>
          {entry.toValue ?? '—'}
        </strong>
        {!applied && (
          <span className="text-neutral-400">
            {' '}
            ({entry.status === 'failed' ? 'failed' : 'not applied'})
          </span>
        )}
      </Typography>
      {entry.error && (
        <Typography variant="caption" className="text-red-400">
          {entry.error}
        </Typography>
      )}
    </div>
  );
}

export function AuditCard({
  group,
  ruleExists,
  rulesLoaded,
}: {
  group: AuditGroup;
  ruleExists: boolean;
  rulesLoaded: boolean;
}) {
  const { base, categorize, approve, status } = group;
  const amount = base.transactionAmount / 1000;

  return (
    <Card color={cardColor[status]} className="flex flex-col gap-3 !p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <Typography variant="h5" component="h2" className="truncate">
            {base.payeeName ?? '—'}
          </Typography>
          <Typography variant="caption" className="text-neutral-400">
            {base.transactionDate}
            {base.accountName ? ` · ${base.accountName}` : ''}
          </Typography>
        </div>
        <Typography
          variant="h5"
          component="span"
          className={amount > 0 ? 'text-green-400' : undefined}
        >
          {formatUnits(amount)}
        </Typography>
      </div>

      <div className="flex flex-col gap-1.5">
        {categorize && (
          <ChangeLine entry={categorize} fallbackFrom="uncategorized" />
        )}
        {approve && <ChangeLine entry={approve} fallbackFrom="unapproved" />}
      </div>

      <HorizontalRule color="neutral" className="my-0" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <Typography variant="caption">
            Rule:{' '}
            {base.filterSelectionId && ruleExists ? (
              <Link
                href={`/budget/filters/${base.filterSelectionId}`}
                className="text-primary-500 underline"
              >
                {base.ruleName}
              </Link>
            ) : (
              <>
                {base.ruleName}
                {base.filterSelectionId && rulesLoaded && (
                  <span className="text-neutral-400"> (deleted)</span>
                )}
              </>
            )}
          </Typography>
          <Typography variant="caption" className="text-neutral-400">
            {base.ruleDescription}
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          {status !== 'applied' && status !== 'unchanged' && (
            <Badge color={cardColor[status]}>{statusLabel[status]}</Badge>
          )}
          <Typography variant="caption" className="text-neutral-400">
            <LocalDate iso={group.appliedAt} />
          </Typography>
        </div>
      </div>
    </Card>
  );
}
