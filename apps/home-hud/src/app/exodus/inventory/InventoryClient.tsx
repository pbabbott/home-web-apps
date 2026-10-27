'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  OutlinedButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import {
  hasActiveFilters,
  inventoryItemsUrl,
  parseDecisionFilter,
  parseKind,
  parseRecommendation,
  RECOMMENDATION_LABELS,
  type DecisionFilter,
} from '../lib/inventory-display';
import { decideInventoryItem } from '../sources/lib/actions';
import type {
  InventoryItemDecision,
  InventoryItemKind,
  InventoryItemRecommendation,
  InventoryItem,
} from '../sources/lib/homelab-api';
import { InventoryItemCard } from './InventoryItemCard';
import { InventoryPagination } from './InventoryPagination';
import { PathCoverageCheck } from './PathCoverageCheck';

interface InventoryClientProps {
  /** Null if the sources could not be loaded. */
  sources: { id: string; name: string }[] | null;
  /** The source being reviewed; null if there are none. */
  sourceId: string | null;
  decision: DecisionFilter;
  recommendation: InventoryItemRecommendation | undefined;
  kind: InventoryItemKind | undefined;
  /** Search text the server filtered by. */
  q: string | undefined;
  /** Set when the view is narrowed to exactly one inventory item. */
  path: string | undefined;
  page: number;
  pageSize: number;
  /** Null if the inventory items could not be loaded. */
  inventoryItems: InventoryItem[] | null;
  /** Every inventory item matching the filters, across all pages. */
  total: number;
}

const selectClass =
  'border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0';

export function InventoryClient({
  sources,
  sourceId,
  decision,
  recommendation,
  kind,
  q,
  path,
  page,
  pageSize,
  inventoryItems,
  total,
}: InventoryClientProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reason typed per row, keyed by inventory item id.
  const [notes, setNotes] = useState<Record<string, string>>({});

  const view = {
    source: sourceId ?? undefined,
    decision,
    recommendation,
    kind,
    q,
    path,
  };
  const filtered = hasActiveFilters(view);

  async function quickDecide(
    inventoryItem: InventoryItem,
    next: InventoryItemDecision,
  ) {
    setBusyId(inventoryItem.id);
    setError(null);

    // An empty box leaves the note out, so the API applies its own default.
    const result = await decideInventoryItem(
      inventoryItem.id,
      next,
      notes[inventoryItem.id]?.trim() || undefined,
    );
    setBusyId(null);

    if (!result.ok) {
      setError(`${inventoryItem.displayName}: ${result.error}`);
      return;
    }

    setNotes(({ [inventoryItem.id]: _sent, ...rest }) => rest);
    router.refresh();
  }

  // Filters are applied by the server; this only turns the form into a URL.
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = new FormData(e.currentTarget).get('q');

    router.push(
      inventoryItemsUrl({
        ...view,
        q: typeof text === 'string' ? text.trim() || undefined : undefined,
      }),
    );
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <Typography variant="h1" component="h1">
          Inventory
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Backup units the agent proposes. Its recommendation is advice only:
          nothing is approved until you approve it, and an approval covers
          everything beneath the path.
        </Typography>
      </div>

      {sources === null ? (
        <Typography variant="body2" className="text-error-400">
          Failed to load sources from homelab-api.
        </Typography>
      ) : sources.length === 0 || sourceId === null ? (
        <Typography variant="body2" className="text-neutral-400">
          No sources yet.{' '}
          <Link
            href="/exodus/sources"
            className="text-primary-400 hover:underline"
          >
            Add one
          </Link>{' '}
          and run a discovery job to get inventoryItems.
        </Typography>
      ) : (
        <>
          <Tabs defaultValue="search" className="flex flex-col gap-6">
            <TabsList>
              <TabsTrigger value="search">Search inventory</TabsTrigger>
              <TabsTrigger value="check">Check a path</TabsTrigger>
            </TabsList>

            <TransparentPanel color="accent-purple" className="py-4">
              <div className="flex min-w-0 max-w-lg flex-col gap-1">
                <Typography
                  variant="small"
                  component="label"
                  htmlFor="inventory-source"
                >
                  Source
                </Typography>
                <div className="flex items-center gap-2">
                  <select
                    id="inventory-source"
                    value={sourceId}
                    onChange={(e) =>
                      router.push(
                        inventoryItemsUrl({ ...view, source: e.target.value }),
                      )
                    }
                    className={`${selectClass} min-w-0 flex-1`}
                  >
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                  <OutlinedButton
                    component={Link}
                    href={`/exodus/sources/${sourceId}`}
                    size="small"
                  >
                    View source →
                  </OutlinedButton>
                </div>
              </div>
            </TransparentPanel>

            <TabsContent value="search" className="flex flex-col gap-6">
              <TransparentPanel
                color="dark"
                className="flex flex-col gap-4 py-4"
              >
                {filtered && (
                  <div className="flex justify-end">
                    <OutlinedButton
                      component={Link}
                      href={inventoryItemsUrl({ source: sourceId })}
                      color="secondary"
                      size="small"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon
                          name="radix-cross-2"
                          size={14}
                          className="text-current"
                        />
                        Clear filters
                      </span>
                    </OutlinedButton>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="flex min-w-0 flex-col gap-1">
                    <Typography variant="small">Decision</Typography>
                    <select
                      value={decision}
                      onChange={(e) =>
                        router.push(
                          inventoryItemsUrl({
                            ...view,
                            decision: parseDecisionFilter(e.target.value),
                          }),
                        )
                      }
                      className={selectClass}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="all">All</option>
                    </select>
                  </label>

                  <label className="flex min-w-0 flex-col gap-1">
                    <Typography variant="small">Agent says</Typography>
                    <select
                      value={recommendation ?? ''}
                      onChange={(e) =>
                        router.push(
                          inventoryItemsUrl({
                            ...view,
                            recommendation: parseRecommendation(e.target.value),
                          }),
                        )
                      }
                      className={selectClass}
                    >
                      <option value="">Anything</option>
                      {Object.entries(RECOMMENDATION_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="flex min-w-0 flex-col gap-1">
                    <Typography variant="small">Type</Typography>
                    <select
                      value={kind ?? ''}
                      onChange={(e) =>
                        router.push(
                          inventoryItemsUrl({
                            ...view,
                            kind: parseKind(e.target.value),
                          }),
                        )
                      }
                      className={selectClass}
                    >
                      <option value="">Files and folders</option>
                      <option value="directory">Folders</option>
                      <option value="file">Files</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-col gap-4 border-t border-neutral-700 pt-4">
                  <form
                    key={q ?? ''}
                    role="search"
                    onSubmit={search}
                    className="flex w-full flex-wrap items-center gap-2"
                  >
                    <Input
                      name="q"
                      color="primary"
                      className="w-72 sm:w-96"
                      placeholder="Search path, name or summary"
                      aria-label="Search inventory items"
                      maxLength={200}
                      defaultValue={q ?? ''}
                    />
                    <Button type="submit">Search</Button>
                  </form>

                  {path && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Typography variant="body2" className="text-neutral-400">
                        Showing only
                      </Typography>
                      <Typography
                        variant="body2"
                        component="span"
                        className="break-all"
                      >
                        {path}
                      </Typography>
                      <OutlinedButton
                        component={Link}
                        aria-label="Clear single-item filter"
                        href={inventoryItemsUrl({ ...view, path: undefined })}
                        color="secondary"
                        size="small"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icon
                            name="radix-cross-2"
                            size={14}
                            className="text-current"
                          />
                          Clear
                        </span>
                      </OutlinedButton>
                    </div>
                  )}
                </div>
              </TransparentPanel>

              <div className="flex flex-col gap-4">
                {inventoryItems !== null && (
                  <InventoryPagination
                    view={view}
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    shown={inventoryItems.length}
                  />
                )}

                {error && (
                  <Typography variant="body2" className="text-error-400">
                    {error}
                  </Typography>
                )}

                {inventoryItems === null ? (
                  <Typography variant="body2" className="text-error-400">
                    Failed to load inventory items from homelab-api.
                  </Typography>
                ) : inventoryItems.length === 0 ? (
                  <Typography variant="body2" className="text-neutral-400">
                    {total > 0
                      ? 'No inventory items on this page.'
                      : filtered
                        ? 'No inventory items match these filters.'
                        : 'Nothing waiting for review.'}
                  </Typography>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {inventoryItems.map((inventoryItem) => (
                      <InventoryItemCard
                        key={inventoryItem.id}
                        inventoryItem={inventoryItem}
                        note={notes[inventoryItem.id] ?? ''}
                        onNoteChange={(note) =>
                          setNotes((prev) => ({
                            ...prev,
                            [inventoryItem.id]: note,
                          }))
                        }
                        busy={busyId === inventoryItem.id}
                        onDecide={(next) => quickDecide(inventoryItem, next)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Kept mounted so a result survives a trip to the other tab. */}
            <TabsContent
              value="check"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <PathCoverageCheck key={sourceId} sourceId={sourceId} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  );
}
