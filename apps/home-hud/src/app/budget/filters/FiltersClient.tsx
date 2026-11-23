'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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
import { LocalDate } from '../lib/LocalDate';
import { saveFilterSelection } from '../lib/actions';
import type {
  FilterSelection,
  FilterSelectionInput,
  YnabReference,
} from '../lib/budget-api';
import { formatUnits } from '../lib/budget-display';

export function summarize(
  rule: FilterSelection,
  reference: YnabReference | null,
): { when: string; then: string } {
  const parts: string[] = [];

  if (rule.accountId) {
    parts.push(
      `account ${reference?.accounts.find((a) => a.id === rule.accountId)?.name ?? rule.accountId}`,
    );
  }

  if (rule.payeeId) {
    parts.push(
      `payee ${reference?.payees.find((p) => p.id === rule.payeeId)?.name ?? rule.payeeId}`,
    );
  }

  const { amountMinMilliunits: min, amountMaxMilliunits: max } = rule;

  if (min !== null && max !== null) {
    parts.push(
      `amount ${formatUnits(min / 1000)} to ${formatUnits(max / 1000)}`,
    );
  } else if (min !== null) {
    parts.push(`amount ≥ ${formatUnits(min / 1000)}`);
  } else if (max !== null) {
    parts.push(`amount ≤ ${formatUnits(max / 1000)}`);
  }

  const actions: string[] = [];

  if (rule.categoryId) {
    actions.push(
      `categorize as ${reference?.categories.find((c) => c.id === rule.categoryId)?.name ?? rule.categoryId}`,
    );
  }

  if (rule.autoApprove) actions.push('approve');

  return { when: parts.join(' · '), then: actions.join(', ') };
}

export function FiltersClient({
  rules,
  reference,
}: {
  rules: FilterSelection[] | null;
  reference: YnabReference | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(rule: FilterSelection, enabled: boolean) {
    setBusy(rule.id);
    setError(null);

    try {
      const input: FilterSelectionInput = {
        name: rule.name,
        enabled,
        planId: rule.planId,
        accountId: rule.accountId,
        payeeId: rule.payeeId,
        amountMinMilliunits: rule.amountMinMilliunits,
        amountMaxMilliunits: rule.amountMaxMilliunits,
        categoryId: rule.categoryId,
        autoApprove: rule.autoApprove,
      };

      await saveFilterSelection(rule.id, input);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Filter Rules
      </Typography>

      <div className="flex max-w-3xl flex-col gap-2">
        <Typography variant="body2" className="text-neutral-400">
          A rule selects transactions by account, payee and amount. After each
          sync, enabled rules categorize and/or approve matching{' '}
          <em>unapproved</em> transactions in YNAB (splits and transfers are
          left alone; only uncategorized transactions get a category). Every
          automatic change is recorded on the Audit page.
        </Typography>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/budget/filters/new">
          <Button size="small">New rule</Button>
        </Link>
        <OutlinedButton size="small" onClick={() => router.refresh()}>
          Refresh
        </OutlinedButton>
      </div>

      {error && (
        <Typography variant="body2" className="text-red-400">
          {error}
        </Typography>
      )}

      {rules === null ? (
        <Typography variant="body2" className="text-red-400">
          Could not load rules from budget-api.
        </Typography>
      ) : rules.length === 0 ? (
        <Typography variant="body2" className="text-neutral-400">
          No rules yet.
        </Typography>
      ) : (
        <ScrollableTable>
          <Table>
            <TableHead>
              <TableRow>
                <Th>Enabled</Th>
                <Th>Name</Th>
                <Th>When</Th>
                <Th>Then</Th>
                <Th>Updated</Th>
                <Th>{''}</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => {
                const { when, then } = summarize(rule, reference);

                return (
                  <TableRow key={rule.id}>
                    <Td>
                      <Switch
                        checked={rule.enabled}
                        disabled={busy === rule.id}
                        onCheckedChange={(v) => void toggle(rule, v)}
                        aria-label={`Enable ${rule.name}`}
                      />
                    </Td>
                    <Td>{rule.name}</Td>
                    <Td>{when}</Td>
                    <Td>{then}</Td>
                    <Td>
                      <LocalDate iso={rule.updatedAt} />
                    </Td>
                    <Td>
                      <Link href={`/budget/filters/${rule.id}`}>Edit</Link>
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollableTable>
      )}
    </main>
  );
}
