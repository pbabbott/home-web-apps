'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  OutlinedButton,
  ScrollableTable,
  Switch,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
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

export function CandidatesClient({
  candidates,
  unapprovedOnly,
  includeCovered,
}: {
  candidates: Candidate[] | null;
  unapprovedOnly: boolean;
  includeCovered: boolean;
}) {
  const router = useRouter();

  function navigate(next: {
    unapprovedOnly: boolean;
    includeCovered: boolean;
  }) {
    const params = new URLSearchParams();

    if (!next.unapprovedOnly) params.set('unapproved', '0');
    if (next.includeCovered) params.set('covered', '1');

    const qs = params.toString();

    router.replace(`/budget/candidates${qs ? `?${qs}` : ''}`);
  }

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Rule Candidates
      </Typography>

      <div className="flex max-w-3xl flex-col gap-2">
        <Typography variant="body2">
          Payees that look like good filter rules, scored on the last 12 months:
          how regularly they land on the same day of the month (a few days of
          slide is fine), how steady the amount is, and how many transactions
          there are. Transfers and splits are ignored.
        </Typography>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2">
          <Switch
            checked={unapprovedOnly}
            onCheckedChange={(v) =>
              navigate({ unapprovedOnly: v, includeCovered })
            }
            aria-label="Un-approved only"
          />
          <Typography variant="body2">Un-approved only</Typography>
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={includeCovered}
            onCheckedChange={(v) =>
              navigate({ unapprovedOnly, includeCovered: v })
            }
            aria-label="Include payees already covered by a rule"
          />
          <Typography variant="body2">Include covered by a rule</Typography>
        </label>
        <OutlinedButton size="small" onClick={() => router.refresh()}>
          Refresh
        </OutlinedButton>
      </div>

      {candidates === null ? (
        <Typography variant="body2">
          Could not load candidates from budget-api.
        </Typography>
      ) : candidates.length === 0 ? (
        <Typography variant="body2">No candidates found.</Typography>
      ) : (
        <ScrollableTable>
          <Table>
            <TableHead>
              <TableRow>
                <Th>Payee</Th>
                <Th>Confidence</Th>
                <Th>Score</Th>
                <Th>Txns</Th>
                <Th>Un-approved</Th>
                <Th>Schedule</Th>
                <Th>Amount</Th>
                <Th>Usual category</Th>
                <Th>Why</Th>
                <Th>Last</Th>
                <Th>Rule</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {candidates.map((c) => (
                <TableRow key={c.key}>
                  <Td>
                    <div className="flex flex-col">
                      <Typography variant="body2" component="span">
                        {c.payeeName}
                      </Typography>
                      {c.payeeNames.length > 1 && (
                        <Typography
                          variant="caption"
                          component="span"
                          title={c.payeeNames.join('\n')}
                        >
                          +{c.payeeNames.length - 1} similar
                        </Typography>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge color={confidenceColor[c.confidence]}>
                      {c.confidence}
                    </Badge>
                  </Td>
                  <Td>{Math.round(c.score)}</Td>
                  <Td>{c.transactionCount}</Td>
                  <Td>{c.unapprovedCount}</Td>
                  <Td>{c.schedule}</Td>
                  <Td>{amountLabel(c)}</Td>
                  <Td>{c.usualCategory ?? '—'}</Td>
                  <Td>
                    <div className="flex flex-col">
                      {c.reasons.map((r) => (
                        <Typography key={r} variant="body2" component="span">
                          {r}
                        </Typography>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <LocalDate iso={c.lastDate} />
                  </Td>
                  <Td>
                    {c.coveredByRule ? (
                      <Badge color="success">covered</Badge>
                    ) : (
                      <Link href={createRuleHref(c)}>
                        <Button size="small">Create rule</Button>
                      </Link>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTable>
      )}
    </main>
  );
}
