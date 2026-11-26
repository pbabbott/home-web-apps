'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Combobox,
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
  FilterMatchRow,
  FilterPreview,
  FilterSelection,
  PayeeMatchType,
  YnabReference,
} from '../../lib/budget-api';
import {
  PAYEE_MATCH_OPTIONS,
  formatUnits,
  milliunitsToUnits,
  unitsToMilliunits,
} from '../../lib/budget-display';

const DEBOUNCE_MS = 400;

interface Props {
  rule: FilterSelection | null;
  planId: string | null;
  reference: YnabReference | null;
  loadError: string | null;
  /** Prefill for a new rule (from the candidates page). */
  initial?: RuleInitial | null;
}

export interface RuleInitial {
  name: string;
  payeeId: string | null;
  payeeMatchType: PayeeMatchType | null;
  payeePattern: string | null;
}

interface CategorySuggestion {
  categoryId: string;
  label: string;
  count: number;
  total: number;
}

interface AmountSuggestion {
  min: string;
  max: string;
  count: number;
}

/** Min/max signed amount over a payee's non-transfer, non-split transactions. */
function usualAmountRange(rows: FilterMatchRow[]): AmountSuggestion | null {
  const amounts = rows
    .filter((row) => !row.isTransfer && !row.isSplit)
    .map((row) => Math.round(Number(row.amountUnits) * 1000))
    .filter(Number.isFinite);

  if (amounts.length === 0) return null;

  return {
    min: milliunitsToUnits(Math.min(...amounts)),
    max: milliunitsToUnits(Math.max(...amounts)),
    count: amounts.length,
  };
}

/** Most common category among a payee's categorized, non-transfer, non-split rows. */
function usualCategory(rows: FilterMatchRow[]): CategorySuggestion | null {
  const counts = new Map<string, { label: string; count: number }>();
  let total = 0;

  for (const row of rows) {
    if (!row.categoryId || row.isTransfer || row.isSplit) continue;
    total += 1;
    const entry = counts.get(row.categoryId) ?? {
      label: [row.categoryGroupName, row.categoryName]
        .filter(Boolean)
        .join(': '),
      count: 0,
    };
    entry.count += 1;
    counts.set(row.categoryId, entry);
  }

  let best: CategorySuggestion | null = null;

  for (const [categoryId, { label, count }] of counts) {
    if (!best || count > best.count) best = { categoryId, label, count, total };
  }

  return best;
}

export function FilterEditor({
  rule,
  planId,
  reference,
  loadError,
  initial = null,
}: Props) {
  const seed = rule ? null : initial;
  const router = useRouter();
  const [name, setName] = useState(rule?.name ?? seed?.name ?? '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [accountId, setAccountId] = useState<string | null>(
    rule?.accountId ?? null,
  );
  const [payeeId, setPayeeId] = useState<string | null>(
    rule?.payeeId ?? seed?.payeeId ?? null,
  );
  // Text matching on the payee name instead of one exact payee.
  const [patternMode, setPatternMode] = useState(
    (rule?.payeePattern ?? seed?.payeePattern ?? null) != null,
  );
  const [payeePattern, setPayeePattern] = useState(
    rule?.payeePattern ?? seed?.payeePattern ?? '',
  );
  const [payeeMatchType, setPayeeMatchType] = useState<PayeeMatchType>(
    rule?.payeeMatchType ?? seed?.payeeMatchType ?? 'starts_with',
  );
  const [min, setMin] = useState(
    milliunitsToUnits(rule?.amountMinMilliunits ?? null),
  );
  const [max, setMax] = useState(
    milliunitsToUnits(rule?.amountMaxMilliunits ?? null),
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    rule?.categoryId ?? null,
  );
  const [autoApprove, setAutoApprove] = useState(rule?.autoApprove ?? true);

  const [preview, setPreview] = useState<FilterPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Payee -> usual category. An existing rule's category counts as a manual
  // choice, so it is never overwritten by a suggestion.
  const categoryTouched = useRef(rule?.categoryId != null);
  const suggestRequestId = useRef(0);
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const amountTouched = useRef(
    rule?.amountMinMilliunits != null || rule?.amountMaxMilliunits != null,
  );
  const [amountSuggestion, setAmountSuggestion] =
    useState<AmountSuggestion | null>(null);

  const accountOptions = (reference?.accounts ?? []).map((a) => ({
    value: a.id,
    label: a.closed ? `${a.name} (closed)` : a.name,
  }));
  const payeeOptions = (reference?.payees ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));
  const categoryOptions = (reference?.categories ?? [])
    .filter((c) => !c.hidden || c.id === rule?.categoryId)
    .map((c) => ({ value: c.id, label: c.name, group: c.groupName }));

  const minUnits = unitsToMilliunits(min);
  const maxUnits = unitsToMilliunits(max);
  const amountInvalid =
    Number.isNaN(minUnits) ||
    Number.isNaN(maxUnits) ||
    (minUnits !== null && maxUnits !== null && minUnits > maxUnits);
  const trimmedPattern = payeePattern.trim();
  // What the payee field currently selects; exactly one form at a time.
  const payeeFilter = patternMode
    ? {
        payeeId: null,
        payeeMatchType: trimmedPattern ? payeeMatchType : null,
        payeePattern: trimmedPattern || null,
      }
    : { payeeId, payeeMatchType: null, payeePattern: null };
  const hasPayeeFilter =
    payeeFilter.payeeId !== null || payeeFilter.payeePattern !== null;
  const hasFilter =
    accountId !== null ||
    hasPayeeFilter ||
    minUnits !== null ||
    maxUnits !== null;
  const hasAction = categoryId !== null || autoApprove;

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
          accountId: accountId,
          ...payeeFilter,
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
    payeeFilter.payeeId,
    payeeFilter.payeeMatchType,
    payeeFilter.payeePattern,
    minUnits,
    maxUnits,
  ]);

  /**
   * Fills the category and amount range from the past transactions the payee
   * filter matches (an exact payee or a text pattern). Manual input wins.
   */
  async function suggestFromPayee(filter: typeof payeeFilter) {
    setSuggestion(null);
    setAmountSuggestion(null);
    const id = ++suggestRequestId.current;
    if (!planId || (filter.payeeId === null && filter.payeePattern === null)) {
      if (!categoryTouched.current) setCategoryId(null);
      if (!amountTouched.current) {
        setMin('');
        setMax('');
      }
      return;
    }

    try {
      const result = await previewFilterSelection({
        planId,
        accountId: null,
        ...filter,
        amountMinMilliunits: null,
        amountMaxMilliunits: null,
      });
      if (id !== suggestRequestId.current) return;

      const best = usualCategory(result.rows);
      // Hidden categories aren't selectable, so don't suggest them.
      const usable =
        best && categoryOptions.some((o) => o.value === best.categoryId)
          ? best
          : null;

      setSuggestion(usable);
      if (!categoryTouched.current) setCategoryId(usable?.categoryId ?? null);

      const range = usualAmountRange(result.rows);
      setAmountSuggestion(range);
      if (!amountTouched.current) {
        setMin(range?.min ?? '');
        setMax(range?.max ?? '');
      }
    } catch {
      // The suggestion is a convenience; the live preview reports real errors.
    }
  }

  function handlePayeeChange(next: string | null) {
    setPayeeId(next);
    void suggestFromPayee({
      payeeId: next,
      payeeMatchType: null,
      payeePattern: null,
    });
  }

  // A prefilled new rule gets its usual category and amounts once on open.
  useEffect(() => {
    if (!seed || !planId) return;

    const timer = setTimeout(() => {
      void suggestFromPayee(
        seed.payeePattern
          ? {
              payeeId: null,
              payeeMatchType: seed.payeeMatchType,
              payeePattern: seed.payeePattern,
            }
          : { payeeId: seed.payeeId, payeeMatchType: null, payeePattern: null },
      );
    }, 0);

    return () => clearTimeout(timer);
    // Runs once on mount (and when the plan arrives).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  // Pattern mode: suggest as the user types, debounced like the preview.
  const patternSuggestKey = patternMode
    ? `${payeeMatchType}:${trimmedPattern}`
    : null;
  const initialPatternKey = useRef(patternSuggestKey);
  useEffect(() => {
    if (patternSuggestKey === null) return;
    // An opened existing rule keeps its saved category and amounts.
    if (patternSuggestKey === initialPatternKey.current) return;
    initialPatternKey.current = null;

    const timer = setTimeout(() => {
      void suggestFromPayee({
        payeeId: null,
        payeeMatchType: trimmedPattern ? payeeMatchType : null,
        payeePattern: trimmedPattern || null,
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // suggestFromPayee only reads refs and setters besides these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternSuggestKey, planId]);

  function handlePatternModeChange(on: boolean) {
    setPatternMode(on);
    if (on) {
      setPayeeId(null);
    } else {
      setPayeePattern('');
    }
    // The other form's suggestions no longer apply.
    suggestRequestId.current++;
    setSuggestion(null);
    setAmountSuggestion(null);
    if (!categoryTouched.current) setCategoryId(null);
    if (!amountTouched.current) {
      setMin('');
      setMax('');
    }
  }

  function handleAmountChange(set: (value: string) => void, value: string) {
    amountTouched.current = true;
    set(value);
  }

  function handleCategoryChange(next: string | null) {
    categoryTouched.current = true;
    setCategoryId(next);
  }

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
        accountId: accountId,
        ...payeeFilter,
        amountMinMilliunits: minUnits,
        amountMaxMilliunits: maxUnits,
        categoryId: categoryId,
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

      <label className="flex max-w-xl flex-col gap-1">
        <Typography variant="body2">Name</Typography>
        <Input
          value={name}
          placeholder="Mortgage"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <Typography variant="h3" component="h2">
            Select transactions
          </Typography>

          <div className="flex flex-col gap-2">
            <Typography variant="body2">Payee</Typography>
            {patternMode ? (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 pr-20">
                  <Input
                    className="w-full"
                    value={payeePattern}
                    placeholder="Royal"
                    aria-label="Payee text"
                    onChange={(e) => setPayeePattern(e.target.value)}
                  />
                </div>
                <div className="w-52 shrink-0">
                  <Select
                    value={payeeMatchType}
                    onValueChange={(v) =>
                      setPayeeMatchType(v as PayeeMatchType)
                    }
                  >
                    <SelectTrigger
                      aria-label="Payee match type"
                      className="w-full min-w-0"
                    />
                    <SelectContent>
                      {PAYEE_MATCH_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <Combobox
                options={payeeOptions}
                value={payeeId}
                onValueChange={handlePayeeChange}
                clearLabel="Any payee"
                placeholder="Any payee"
                searchPlaceholder="Search payees…"
                emptyText="No payees found"
              />
            )}
            <label className="flex items-center gap-3">
              <Switch
                checked={patternMode}
                onCheckedChange={handlePatternModeChange}
              />
              <Typography variant="body2">
                Match payee by text (covers name variants)
              </Typography>
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <Typography variant="body2">Account</Typography>
            <Combobox
              options={accountOptions}
              value={accountId}
              onValueChange={setAccountId}
              clearLabel="Any account"
              placeholder="Any account"
              searchPlaceholder="Search accounts…"
              emptyText="No accounts found"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <Typography variant="body2">Amount min</Typography>
              <Input
                value={min}
                placeholder="-2500"
                onChange={(e) => handleAmountChange(setMin, e.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <Typography variant="body2">Amount max</Typography>
              <Input
                value={max}
                placeholder="-2000"
                onChange={(e) => handleAmountChange(setMax, e.target.value)}
              />
            </label>
          </div>
          <Typography variant="caption" className="text-neutral-400">
            Outflows are negative: a 2,200.00 payment is -2200. Leave a side
            blank for no limit.
          </Typography>
          {amountSuggestion && (
            <Typography variant="caption" className="text-neutral-400">
              Past range for {patternMode ? 'matching payees' : 'this payee'}:{' '}
              {amountSuggestion.min} to {amountSuggestion.max} (
              {amountSuggestion.count} transactions)
            </Typography>
          )}
          {amountInvalid && (
            <Typography variant="body2" className="text-red-400">
              Enter numbers, with min no greater than max.
            </Typography>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <Typography variant="h3" component="h2">
            Then, for unapproved matches
          </Typography>

          <div className="flex flex-col gap-1">
            <Typography variant="body2">Categorize as</Typography>
            <Combobox
              options={categoryOptions}
              value={categoryId}
              onValueChange={handleCategoryChange}
              clearLabel="Don't categorize"
              placeholder="Don't categorize"
              searchPlaceholder="Search categories…"
              emptyText="No categories found"
            />
            {suggestion && (
              <Typography variant="caption" className="text-neutral-400">
                Usually {suggestion.label} ({suggestion.count} of{' '}
                {suggestion.total} past transactions for{' '}
                {patternMode ? 'matching payees' : 'this payee'})
              </Typography>
            )}
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
                color="error"
                disabled={saving}
                onClick={() => void remove()}
              >
                Delete
              </OutlinedButton>
            )}
          </div>
        </section>
      </div>

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
