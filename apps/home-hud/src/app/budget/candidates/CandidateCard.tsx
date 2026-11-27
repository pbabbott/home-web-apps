import {
  Badge,
  Button,
  Card,
  HorizontalRule,
  Typography,
} from '@abbottland/fui-components';
import Link from 'next/link';
import type { Candidate, CandidateConfidence } from '../lib/budget-api';
import { formatUnits } from '../lib/budget-display';
import { LocalDate } from '../lib/LocalDate';

const confidenceColor: Record<
  CandidateConfidence,
  'success' | 'warning' | 'secondary'
> = { high: 'success', medium: 'warning', low: 'secondary' };

export function amountLabel(c: Candidate): string {
  const lo = formatUnits(c.amountMin);
  const hi = formatUnits(c.amountMax);

  return lo === hi ? lo : `${lo} to ${hi}`;
}

/** Link to the rule editor, prefilled from the candidate. */
export function createRuleHref(c: Candidate): string {
  const params = new URLSearchParams({ name: c.payeeName });

  if (c.payeeId) {
    params.set('payeeId', c.payeeId);
  } else if (c.commonPrefix) {
    params.set('matchType', 'starts_with');
    params.set('pattern', c.commonPrefix);
  } else {
    params.set('matchType', 'equals');
    params.set('pattern', c.payeeName);
  }

  return `/budget/filters/new?${params.toString()}`;
}

export function CandidateCard({ candidate: c }: { candidate: Candidate }) {
  return (
    <Card
      color={confidenceColor[c.confidence]}
      className="flex flex-col gap-3 !p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <Typography variant="h5" component="h2">
            {c.payeeName}
          </Typography>
          {c.payeeNames.length > 1 && (
            <Typography variant="caption" title={c.payeeNames.join('\n')}>
              +{c.payeeNames.length - 1} similar
            </Typography>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge color={confidenceColor[c.confidence]}>{c.confidence}</Badge>
          <Typography variant="h5" component="span">
            {Math.round(c.score)}
          </Typography>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Typography variant="body1" component="div">
          {c.schedule} · {amountLabel(c)}
        </Typography>
        <Typography variant="body1" component="div">
          {c.usualCategory ?? 'No usual category'}
        </Typography>
      </div>

      <div className="flex flex-col">
        {c.reasons.map((r) => (
          <Typography key={r} variant="body2" component="span">
            {r}
          </Typography>
        ))}
      </div>

      <HorizontalRule color="neutral" className="my-0" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <Typography variant="caption">
            {c.transactionCount} transactions · {c.unapprovedCount} un-approved
          </Typography>
          <Typography variant="caption">
            Last: <LocalDate iso={c.lastDate} />
          </Typography>
        </div>
        {c.coveredByRule ? (
          <Badge color="success">covered by a rule</Badge>
        ) : (
          <Link href={createRuleHref(c)}>
            <Button size="small">Create rule</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
