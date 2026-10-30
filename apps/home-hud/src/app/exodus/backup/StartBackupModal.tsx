'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Scrollbar,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Typography,
} from '@abbottland/fui-components';
import { formatSize } from '../lib/inventory-display';
import { planWarningText } from '../lib/backup-display';
import {
  createBackupJob,
  listApprovedInventoryForBackup,
  planBackupJob,
  type BackupInventoryChoice,
} from '../sources/lib/actions';
import type { BackupPlan } from '../sources/lib/homelab-api';

type Scope = 'source' | 'inventory';

const SEARCH_DEBOUNCE_MS = 300;

/** The dry-run numbers; shared by both scopes. */
function PlanSummary({ plan }: { plan: BackupPlan }) {
  const rows: [string, string][] = [
    ['Items to copy', String(plan.summary.toCopy)],
    [
      'Estimated size',
      plan.summary.toCopy === 0
        ? '—'
        : `${formatSize(plan.summary.estimatedBytes)}${plan.summary.unestimatedItems > 0 ? ' or more' : ''}`,
    ],
    ['Items without a size estimate', String(plan.summary.unestimatedItems)],
    ['Excluded by a rule', String(plan.summary.excluded)],
    ['Already on the destination', String(plan.summary.skippedAlreadyCovered)],
    [
      'Inside another approved folder',
      String(plan.summary.skippedRedundantNested),
    ],
    ['Not eligible (not approved)', String(plan.summary.notEligible)],
  ];

  return (
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
  );
}

/** Plans on mount and whenever `itemId` changes; `itemId` null plans the whole source. */
function usePlan(
  sourceId: string,
  destinationId: string,
  itemId: string | null,
  enabled: boolean,
) {
  // The key says which request the result answers, so a stale one is ignored
  // without resetting state inside the effect.
  const key = `${sourceId}:${destinationId}:${itemId ?? ''}`;
  const [result, setResult] = useState<{
    key: string;
    plan: BackupPlan | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void planBackupJob(
      sourceId,
      destinationId,
      itemId ? [itemId] : undefined,
    ).then((res) => {
      if (cancelled) return;
      setResult(
        res.ok
          ? { key, plan: res.data, error: null }
          : { key, plan: null, error: res.error },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [sourceId, destinationId, itemId, enabled, key]);

  const current = enabled && result?.key === key ? result : null;

  return { plan: current?.plan ?? null, error: current?.error ?? null };
}

/**
 * A scroll area that fills the space its parent gives it, drawn with the fui
 * Scrollbar in place of the native one. The Scrollbar needs a pixel height, so
 * the area's height is measured.
 */
function ScrollList({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ position: 0, size: 1, height: 0 });

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const size = Math.min(clientHeight / scrollHeight, 1);
    const scrollable = scrollHeight - clientHeight;
    const position = scrollable > 0 ? scrollTop / scrollable : 0;
    setThumb({ position: position * (1 - size), size, height: clientHeight });
  }, []);

  // Both the area (modal layout) and its content (results loading) change size.
  useEffect(() => {
    const area = scrollRef.current;
    const content = contentRef.current;
    if (!area || !content) return;

    const observer = new ResizeObserver(sync);
    observer.observe(area);
    observer.observe(content);
    sync();

    return () => observer.disconnect();
  }, [sync]);

  function dragTo(thumbPosition: number) {
    const el = scrollRef.current;
    if (!el || thumb.size >= 1) return;

    const fraction = thumbPosition / (1 - thumb.size);
    el.scrollTop = fraction * (el.scrollHeight - el.clientHeight);
  }

  function page(direction: 'up' | 'down') {
    const el = scrollRef.current;
    if (!el) return;

    el.scrollBy({
      top: (direction === 'up' ? -1 : 1) * el.clientHeight,
      behavior: 'smooth',
    });
  }

  return (
    <div className="relative min-h-48 flex-1">
      <div
        ref={scrollRef}
        onScroll={sync}
        className="absolute inset-y-0 left-0 right-8 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={contentRef} className="flex flex-col gap-1">
          {children}
        </div>
      </div>
      {thumb.height > 0 && (
        <Scrollbar
          className="absolute right-0 top-0"
          height={thumb.height}
          thumbPosition={thumb.position}
          thumbSize={thumb.size}
          onThumbPositionChange={dragTo}
          onPageStep={page}
        />
      )}
    </div>
  );
}

/** Search box and pick list of approved inventory items. */
function InventoryPicker({
  sourceId,
  selectedId,
  onSelect,
}: {
  sourceId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [choices, setChoices] = useState<{
    items: BackupInventoryChoice[];
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void listApprovedInventoryForBackup(sourceId, q).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setChoices(result.data);
          setError(null);
        } else setError(result.error);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sourceId, q]);

  return (
    <div className="flex flex-1 flex-col gap-2">
      {/* Input's underline is sized to its wrapper, not the field, so the width goes on a wrapper here. */}
      <div className="w-72 max-w-full sm:w-96">
        <Input
          color="primary"
          className="w-full"
          placeholder="Search approved inventory"
          aria-label="Search approved inventory items"
          maxLength={200}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ScrollList>
        {!choices && !error && (
          <Typography variant="body2" className="text-neutral-400">
            Loading…
          </Typography>
        )}
        {choices?.items.length === 0 && (
          <Typography variant="body2" className="text-neutral-400">
            No approved inventory items.
          </Typography>
        )}
        {choices?.items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item.id)}
            className={`flex cursor-pointer items-center gap-2 px-2 py-1 text-left hover:bg-neutral-700 ${item.id === selectedId ? 'bg-neutral-700' : ''}`}
          >
            <Badge color={item.kind === 'directory' ? 'secondary' : 'dark'}>
              {item.kind}
            </Badge>
            <Typography variant="body2" className="break-all">
              {item.rootPath}
            </Typography>
          </button>
        ))}
      </ScrollList>
      {choices && choices.total > choices.items.length && (
        <Typography variant="caption" className="text-neutral-400">
          Showing {choices.items.length} of {choices.total}. Refine the search.
        </Typography>
      )}
      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}
    </div>
  );
}

/**
 * "Start backup job": mount it only while open, so each opening plans afresh.
 * Each scope plans (a dry run that writes nothing), shows the numbers, and
 * the job is created on confirm. Source covers every approved item; Inventory
 * covers one chosen item, so a backup can be tried out small first.
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
  const [scope, setScope] = useState<Scope>('source');
  const [itemId, setItemId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const sourcePlan = usePlan(sourceId, destinationId, null, true);
  const itemPlan = usePlan(sourceId, destinationId, itemId, itemId !== null);
  const active = scope === 'source' ? sourcePlan : itemPlan;
  const canCreate =
    !creating && !!active.plan && active.plan.summary.toCopy > 0;

  async function create() {
    setCreating(true);
    setCreateError(null);
    const result = await createBackupJob(
      sourceId,
      destinationId,
      scope === 'inventory' && itemId ? [itemId] : undefined,
    );
    setCreating(false);

    if (!result.ok) {
      setCreateError(result.error);
      return;
    }

    onOpenChange(false);
    router.push(`/exodus/backup/${result.data.id}`);
  }

  const error = createError ?? active.error;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent color="secondary" className="max-w-2xl">
        <ModalTitle>Start backup job</ModalTitle>
        <ModalDescription>
          Copies approved inventory to the destination. The scope is fixed when
          the job is created; later approvals need a new job.
        </ModalDescription>

        <Tabs
          value={scope}
          onValueChange={(value) => {
            setScope(value as Scope);
            setCreateError(null);
          }}
          className="mt-4 flex min-h-[36rem] flex-col gap-3"
        >
          <TabsList>
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="source" className="flex flex-col gap-3">
            <Typography variant="body2" className="text-neutral-400">
              Every approved item of the source.
            </Typography>
            {!sourcePlan.plan && !sourcePlan.error && (
              <Typography variant="body2" className="text-neutral-400">
                Planning…
              </Typography>
            )}
            {sourcePlan.plan && <PlanSummary plan={sourcePlan.plan} />}
          </TabsContent>

          <TabsContent value="inventory" className="flex flex-1 flex-col gap-3">
            <Typography variant="body2" className="text-neutral-400">
              One approved inventory item, to try a backup before running the
              whole source.
            </Typography>
            <InventoryPicker
              sourceId={sourceId}
              selectedId={itemId}
              onSelect={setItemId}
            />
            {itemId && !itemPlan.plan && !itemPlan.error && (
              <Typography variant="body2" className="text-neutral-400">
                Planning…
              </Typography>
            )}
            {itemPlan.plan && <PlanSummary plan={itemPlan.plan} />}
          </TabsContent>
        </Tabs>

        {error && (
          <Typography variant="body2" className="mt-3 text-error-400">
            {error}
          </Typography>
        )}

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
            disabled={!canCreate}
            onClick={() => void create()}
          >
            {creating ? 'Creating…' : 'Create job'}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
