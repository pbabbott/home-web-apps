'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  OutlinedButton,
  ScrollableTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Switch,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import {
  deleteFilterSelection,
  previewFilterSelection,
  saveFilterSelection,
} from '../../lib/actions';
import type {
  FilterPreview,
  FilterSelection,
  YnabReference,
} from '../../lib/budget-api';
import {
  formatUnits,
  milliunitsToUnits,
  unitsToMilliunits,
} from '../../lib/budget-display';

const ANY = '__any__';
const NONE = '__none__';
const DEBOUNCE_MS = 400;

interface Props {
  rule: FilterSelection | null;
  planId: string | null;
  reference: YnabReference | null;
  loadError: string | null;
}

export function FilterEditor({ rule, planId, reference, loadError }: Props) {
  const router = useRouter();
  const [name, setName] = useState(rule?.name ?? '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [accountId, setAccountId] = useState(rule?.accountId ?? ANY);
  const [payeeId, setPayeeId] = useState(rule?.payeeId ?? ANY);
  const [min, setMin] = useState(
    milliunitsToUnits(rule?.amountMinMilliunits ?? null),
  );
  const [max, setMax] = useState(
    milliunitsToUnits(rule?.amountMaxMilliunits ?? null),
  );
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? NONE);
  const [autoApprove, setAutoApprove] = useState(rule?.autoApprove ?? false);

  const [preview, setPreview] = useState<FilterPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestId = useRef(0);

  const minUnits = unitsToMilliunits(min);
  const maxUnits = unitsToMilliunits(max);
  const amountInvalid =
    Number.isNaN(minUnits) ||
    Number.isNaN(maxUnits) ||
    (minUnits !== null && maxUnits !== null && minUnits > maxUnits);
  const hasFilter =
    accountId !== ANY ||
    payeeId !== ANY ||
    minUnits !== null ||
    maxUnits !== null;
  const hasAction = categoryId !== NONE || autoApprove;

  // Debounced live preview; stale responses are dropped via requestId.
  useEffect(() => {
    if (!planId || !hasFilter || amountInvalid) {
      // Nothing to preview; the render below hides any stale result.
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);

      try {
        const result = await previewFilterSelection({
          planId,
          accountId: accountId === ANY ? null : accountId,
          payeeId: payeeId === ANY ? null : payeeId,
          amountMinMilliunits: minUnits,
          amountMaxMilliunits: maxUnits,
        });

        if (id === requestId.current) {
          setPreview(result);
          setPreviewError(null);
        }
      } catch (err) {
        if (id === requestId.current) {
          setPreviewError(
            err instanceof Error ? err.message : 'Preview failed',
          );
        }
      } finally {
        if (id === requestId.current) setPreviewing(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    planId,
    hasFilter,
    amountInvalid,
    accountId,
    payeeId,
    minUnits,
    maxUnits,
  ]);

  const canSave =
    planId !== null &&
    name.trim() !== '' &&
    hasFilter &&
    hasAction &&
    !amountInvalid;

  async function save() {
    if (!planId) return;
    setSaving(true);
    setSaveError(null);

    try {
      await saveFilterSelection(rule?.id ?? null, {
        name: name.trim(),
        enabled,
        planId,
        accountId: accountId === ANY ? null : accountId,
        payeeId: payeeId === ANY ? null : payeeId,
        amountMinMilliunits: minUnits,
        amountMaxMilliunits: maxUnits,
        categoryId: categoryId === NONE ? null : categoryId,
        autoApprove,
      });
      router.push('/budget/filters');
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  async function remove() {
    if (!rule) return;
    if (
      !window.confirm(
        'Delete this rule? Its past audit entries are kept with the rule text as it was.',
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await deleteFilterSelection(rule.id);
      router.push('/budget/filters');
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete');
      setSaving(false);
    }
  }

  const visibleCategories = (reference?.categories ?? []).filter(
    (c) => !c.hidden || c.id === rule?.categoryId,
  );

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <div className="flex items-center gap-4">
        <Typography variant="h1" component="h1">
          {rule ? 'Edit rule' : 'New rule'}
        </Typography>
        <Link href="/budget/filters" className="text-neutral-400 underline">
          Back to rules
        </Link>
      </div>

      {(loadError || !planId || !reference) && (
        <Typography variant="body2" className="text-red-400">
          {loadError ??
            'No synced YNAB plan yet. Run a sync and transform first.'}
        </Typography>
      )}

      <section className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <Typography variant="body2">Name</Typography>
          <Input
            value={name}
            placeholder="Mortgage"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <Typography variant="h3" component="h2">
          Select transactions
        </Typography>

        <div className="flex flex-col gap-1">
          <Typography variant="body2">Account</Typography>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger placeholder="Any account" />
            <SelectContent>
              <SelectItem value={ANY}>Any account</SelectItem>
              {(reference?.accounts ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {a.closed ? ' (closed)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Typography variant="body2">Payee</Typography>
          <Select value={payeeId} onValueChange={setPayeeId}>
            <SelectTrigger placeholder="Any payee" />
            <SelectContent>
              <SelectItem value={ANY}>Any payee</SelectItem>
              {(reference?.payees ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <Typography variant="body2">Amount min</Typography>
            <Input
              value={min}
              placeholder="-2500"
              onChange={(e) => setMin(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <Typography variant="body2">Amount max</Typography>
            <Input
              value={max}
              placeholder="-2000"
              onChange={(e) => setMax(e.target.value)}
            />
          </label>
        </div>
        <Typography variant="caption" className="text-neutral-400">
          Outflows are negative: a 2,200.00 payment is -2200. Leave a side blank
          for no limit.
        </Typography>
        {amountInvalid && (
          <Typography variant="body2" className="text-red-400">
            Enter numbers, with min no greater than max.
          </Typography>
        )}

        <Typography variant="h3" component="h2">
          Then, for unapproved matches
        </Typography>

        <div className="flex flex-col gap-1">
          <Typography variant="body2">Categorize as</Typography>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger placeholder="Don’t categorize" />
            <SelectContent>
              <SelectItem value={NONE}>Don’t categorize</SelectItem>
              {visibleCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.groupName}: {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-3">
          <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
          <Typography variant="body2">Auto approve</Typography>
        </label>

        <label className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Typography variant="body2">
            Enabled (runs after each sync)
          </Typography>
        </label>

        {saveError && (
          <Typography variant="body2" className="text-red-400">
            {saveError}
          </Typography>
        )}

        <div className="flex gap-3">
          <Button
            size="small"
            disabled={!canSave || saving}
            onClick={() => void save()}
          >
            {rule ? 'Save changes' : 'Create rule'}
          </Button>
          {rule && (
            <OutlinedButton
              size="small"
              disabled={saving}
              onClick={() => void remove()}
            >
              Delete
            </OutlinedButton>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Typography variant="h3" component="h2">
            Preview
          </Typography>
          {previewing && <Badge color="dark">updating…</Badge>}
        </div>

        {previewError && hasFilter && !amountInvalid && (
          <Typography variant="body2" className="text-red-400">
            {previewError}
          </Typography>
        )}

        {!hasFilter || amountInvalid ? (
          <Typography variant="body2" className="text-neutral-400">
            Choose at least one filter to see matching transactions.
          </Typography>
        ) : preview === null ? (
          <Typography variant="body2" className="text-neutral-400">
            Loading…
          </Typography>
        ) : (
          <>
            <Typography variant="body2" className="text-neutral-300">
              {preview.matched} matching transactions in history;{' '}
              {preview.actionable} are unapproved (non-split, non-transfer) and
              would be acted on by the next run.
              {preview.truncated &&
                ` Showing the ${preview.rows.length} most recent.`}
            </Typography>
            <ScrollableTable>
              <Table>
                <TableHead>
                  <TableRow>
                    <Th>Date</Th>
                    <Th>Account</Th>
                    <Th>Payee</Th>
                    <Th>Amount</Th>
                    <Th>Category</Th>
                    <Th>Status</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.id}>
                      <Td>{row.date}</Td>
                      <Td>{row.accountName ?? '—'}</Td>
                      <Td>{row.payeeName ?? '—'}</Td>
                      <Td>{formatUnits(row.amountUnits)}</Td>
                      <Td>{row.categoryName ?? 'uncategorized'}</Td>
                      <Td>
                        {row.approved ? (
                          <Badge color="success">approved</Badge>
                        ) : row.isSplit || row.isTransfer ? (
                          <Badge color="dark">
                            {row.isSplit ? 'split' : 'transfer'} (skipped)
                          </Badge>
                        ) : (
                          <Badge color="warning">will act</Badge>
                        )}
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          </>
        )}
      </section>
    </main>
  );
}
