'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  OutlinedButton,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Switch,
  Td,
  Th,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import {
  changedSinceDecision,
  hasActiveFilters,
  inventoryItemsUrl,
  DECISION_COLOR,
  DECISION_LABELS,
  parseDecisionFilter,
  parseKind,
  parseRecommendation,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
  type DecisionFilter,
  type InventoryLayout,
} from '../lib/inventory-display';
import { LocalDateTime } from '../lib/LocalDateTime';
import { PreviewButton } from '../lib/PreviewButton';
import { decideInventoryItem } from '../sources/lib/actions';
import type {
  InventoryItemDecision,
  InventoryItemKind,
  InventoryItemRecommendation,
  InventoryItem,
} from '../sources/lib/homelab-api';
import { InventoryItemCard } from './InventoryItemCard';
import { InventoryItemDetailModal } from './InventoryItemDetailModal';
import { InventoryPagination } from './InventoryPagination';

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
  layout: InventoryLayout;
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
  layout,
  page,
  pageSize,
  inventoryItems,
  total,
}: InventoryClientProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
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
    layout,
  };
  const filtered = hasActiveFilters(view);
  // Looked up by id so the modal shows fresh data after a refresh.
  const open = inventoryItems?.find((c) => c.id === openId) ?? null;

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
        <TransparentPanel color="dark" className="flex flex-col gap-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Typography variant="body2">View mode</Typography>
              <Typography
                variant="small"
                component="label"
                htmlFor="inventory-layout"
              >
                Table
              </Typography>
              <Switch
                id="inventory-layout"
                aria-label="Show inventory items as cards"
                checked={layout === 'cards'}
                onCheckedChange={(checked) =>
                  router.push(
                    inventoryItemsUrl({
                      ...view,
                      layout: checked ? 'cards' : 'table',
                    }),
                  )
                }
              />
              <Typography
                variant="small"
                component="label"
                htmlFor="inventory-layout"
              >
                Cards
              </Typography>
            </div>
            {filtered && (
              <OutlinedButton
                component={Link}
                href={inventoryItemsUrl({ source: sourceId, layout })}
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
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Typography
                variant="small"
                component="label"
                htmlFor="inventory-source"
              >
                Source
              </Typography>
              <div className="flex flex-col items-start gap-2">
                <select
                  id="inventory-source"
                  value={sourceId}
                  onChange={(e) =>
                    router.push(
                      inventoryItemsUrl({ ...view, source: e.target.value }),
                    )
                  }
                  className={`${selectClass} w-full`}
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
                  color="accent-falcon"
                  size="small"
                >
                  View source →
                </OutlinedButton>
              </div>
            </div>

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
                {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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
      )}

      {sourceId !== null && (
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
          ) : layout === 'cards' ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {inventoryItems.map((inventoryItem) => (
                <InventoryItemCard
                  key={inventoryItem.id}
                  inventoryItem={inventoryItem}
                  note={notes[inventoryItem.id] ?? ''}
                  onNoteChange={(note) =>
                    setNotes((prev) => ({ ...prev, [inventoryItem.id]: note }))
                  }
                  busy={busyId === inventoryItem.id}
                  onDecide={(next) => quickDecide(inventoryItem, next)}
                />
              ))}
            </div>
          ) : (
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Path</Th>
                    <Th>Approval</Th>
                    <Th>Agent says</Th>
                    <Th>Decision</Th>
                    <Th>Updated</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inventoryItems.map((inventoryItem) => (
                    <TableRow key={inventoryItem.id}>
                      <Td className="break-all">
                        <button
                          type="button"
                          onClick={() => setOpenId(inventoryItem.id)}
                          className="text-left text-primary-400 hover:underline"
                        >
                          <Icon
                            name={
                              inventoryItem.kind === 'file'
                                ? 'radix-file'
                                : 'folder'
                            }
                            title={
                              inventoryItem.kind === 'file' ? 'File' : 'Folder'
                            }
                            className="mr-1.5 inline-block align-text-bottom text-neutral-400"
                          />
                          {inventoryItem.rootPath}
                        </button>
                        {inventoryItem.kind === 'file' && (
                          <PreviewButton
                            sourceId={inventoryItem.sourceId}
                            path={inventoryItem.rootPath}
                            className="ml-1 align-text-bottom"
                          />
                        )}
                        <div>
                          <span className="text-neutral-400">What: </span>
                          {inventoryItem.summary}
                        </div>
                        <div>
                          <span className="text-neutral-400">Why: </span>
                          {inventoryItem.recommendationReason}
                        </div>
                        <div>
                          <Icon
                            name="radix-eye-open"
                            title="Looks like"
                            className="mr-1.5 inline-block align-text-bottom text-neutral-400"
                          />
                          {inventoryItem.evidence.contentKinds.join(', ') ||
                            'unclassified'}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-2">
                          {inventoryItem.decision === 'pending' && (
                            <Input
                              color="primary"
                              className="w-full min-w-48"
                              placeholder="Reason (optional)"
                              aria-label={`Reason for ${inventoryItem.displayName}`}
                              maxLength={1000}
                              disabled={busyId === inventoryItem.id}
                              value={notes[inventoryItem.id] ?? ''}
                              onChange={(e) =>
                                setNotes((prev) => ({
                                  ...prev,
                                  [inventoryItem.id]: e.target.value,
                                }))
                              }
                            />
                          )}
                          <div className="flex flex-wrap gap-2">
                            {inventoryItem.decision === 'pending' && (
                              <>
                                <Button
                                  size="small"
                                  disabled={busyId === inventoryItem.id}
                                  onClick={() =>
                                    quickDecide(inventoryItem, 'approved')
                                  }
                                >
                                  Approve
                                </Button>
                                <OutlinedButton
                                  size="small"
                                  color="error"
                                  disabled={busyId === inventoryItem.id}
                                  onClick={() =>
                                    quickDecide(inventoryItem, 'rejected')
                                  }
                                >
                                  Reject
                                </OutlinedButton>
                              </>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            color={
                              RECOMMENDATION_COLOR[inventoryItem.recommendation]
                            }
                          >
                            {
                              RECOMMENDATION_LABELS[
                                inventoryItem.recommendation
                              ]
                            }
                          </Badge>
                          <Typography
                            variant="small"
                            className="text-neutral-400"
                          >
                            ({inventoryItem.confidence})
                          </Typography>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge color={DECISION_COLOR[inventoryItem.decision]}>
                            {DECISION_LABELS[inventoryItem.decision]}
                          </Badge>
                          {changedSinceDecision(inventoryItem) && (
                            <Badge color="warning">Agent changed</Badge>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <LocalDateTime iso={inventoryItem.recommendedAt} />
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </div>
      )}

      <InventoryItemDetailModal
        inventoryItem={open}
        onClose={() => setOpenId(null)}
        onDecided={() => {
          setOpenId(null);
          router.refresh();
        }}
      />
    </main>
  );
}
