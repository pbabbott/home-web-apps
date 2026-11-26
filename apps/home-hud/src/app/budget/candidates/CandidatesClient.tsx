'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OutlinedButton, Switch, Typography } from '@abbottland/fui-components';
import type { Candidate } from '../lib/budget-api';
import { CandidateCard } from './CandidateCard';

const PAGE_SIZE = 25;

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
  const [page, setPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil((candidates?.length ?? 0) / PAGE_SIZE),
  );
  const rows = candidates?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function navigate(next: {
    unapprovedOnly: boolean;
    includeCovered: boolean;
  }) {
    const params = new URLSearchParams();

    if (!next.unapprovedOnly) params.set('unapproved', '0');
    if (next.includeCovered) params.set('covered', '1');

    const qs = params.toString();

    setPage(1);
    router.replace(`/budget/candidates${qs ? `?${qs}` : ''}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-800 p-8">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <Typography variant="h1" component="h1">
          Rule Candidates
        </Typography>

        <Typography variant="body2">
          Payees that look like good filter rules, scored on the last 12 months:
          how regularly they land on the same day of the month (a few days of
          slide is fine), how steady the amount is, and how many transactions
          there are. Transfers and splits are ignored.
        </Typography>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2">
            <Switch
              checked={unapprovedOnly}
              onCheckedChange={(v) =>
                navigate({ unapprovedOnly: v, includeCovered })
              }
              aria-label="Un-approved only"
            />
            <Typography variant="body2" component="span">
              Un-approved only
            </Typography>
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={includeCovered}
              onCheckedChange={(v) =>
                navigate({ unapprovedOnly, includeCovered: v })
              }
              aria-label="Include payees already covered by a rule"
            />
            <Typography variant="body2" component="span">
              Include covered by a rule
            </Typography>
          </label>
          <OutlinedButton size="small" onClick={() => router.refresh()}>
            Refresh
          </OutlinedButton>
        </div>

        {rows === undefined || candidates === null ? (
          <Typography variant="body2">
            Could not load candidates from budget-api.
          </Typography>
        ) : candidates.length === 0 ? (
          <Typography variant="body2">No candidates found.</Typography>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {rows.map((c) => (
                <CandidateCard key={c.key} candidate={c} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <OutlinedButton
                  size="small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </OutlinedButton>
                <Typography variant="body2">
                  Page {page} of {totalPages}
                </Typography>
                <OutlinedButton
                  size="small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </OutlinedButton>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
