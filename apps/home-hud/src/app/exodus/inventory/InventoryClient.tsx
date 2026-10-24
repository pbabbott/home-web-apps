'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  OutlinedButton,
  Panel,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import {
  inventoryItemsUrl,
  changedSinceDecision,
  DECISION_COLOR,
  DECISION_LABELS,
  parseDecisionFilter,
  parseRecommendation,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
  type DecisionFilter,
} from '../lib/inventory-display';
import { LocalDateTime } from '../lib/LocalDateTime';
import { decideInventoryItem } from '../sources/lib/actions';
import type {
  InventoryItemDecision,
  InventoryItemRecommendation,
  InventoryItem,
} from '../sources/lib/homelab-api';
import { InventoryItemDetailModal } from './InventoryItemDetailModal';

interface InventoryClientProps {
  /** Null if the sources could not be loaded. */
  sources: { id: string; name: string }[] | null;
  /** The source being reviewed; null if there are none. */
  sourceId: string | null;
  decision: DecisionFilter;
  recommendation: InventoryItemRecommendation | undefined;
  isFirstPage: boolean;
  /** Null if the inventory items could not be loaded. */
  inventoryItems: InventoryItem[] | null;
  nextCursor: string | null;
}

const selectClass =
  'border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0';

export function InventoryClient({
  sources,
  sourceId,
  decision,
  recommendation,
  isFirstPage,
  inventoryItems,
  nextCursor,
}: InventoryClientProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reason typed per row, keyed by inventory item id.
  const [notes, setNotes] = useState<Record<string, string>>({});

  const view = { source: sourceId ?? undefined, decision, recommendation };
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

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
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
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <Typography variant="small" className="text-neutral-400">
              Source
            </Typography>
            <select
              value={sourceId}
              onChange={(e) =>
                router.push(
                  inventoryItemsUrl({ ...view, source: e.target.value }),
                )
              }
              className={selectClass}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <Typography variant="small" className="text-neutral-400">
              Decision
            </Typography>
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

          <label className="flex items-center gap-2">
            <Typography variant="small" className="text-neutral-400">
              Agent says
            </Typography>
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

          <OutlinedButton
            component={Link}
            href={`/exodus/sources/${sourceId}`}
            color="accent-falcon"
            size="small"
          >
            View source →
          </OutlinedButton>
        </div>
      )}

      {sourceId !== null && (
        <Panel color="default" className="flex flex-col gap-4">
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
              {!isFirstPage
                ? 'No more inventory items.'
                : decision === 'pending' && !recommendation
                  ? 'Nothing waiting for review.'
                  : 'No inventory items match these filters.'}
            </Typography>
          ) : (
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Path</Th>
                    <Th>Approval</Th>
                    <Th>Agent says</Th>
                    <Th>Confidence</Th>
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
                        <Badge
                          color={
                            RECOMMENDATION_COLOR[inventoryItem.recommendation]
                          }
                        >
                          {RECOMMENDATION_LABELS[inventoryItem.recommendation]}
                        </Badge>
                      </Td>
                      <Td>{inventoryItem.confidence}</Td>
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

          {inventoryItems !== null && (!isFirstPage || nextCursor) && (
            <div className="flex items-center justify-between gap-3">
              {isFirstPage ? (
                <span />
              ) : (
                <Link
                  href={inventoryItemsUrl(view)}
                  className="text-primary-400 hover:underline"
                >
                  <Typography variant="small" component="span">
                    ← First page
                  </Typography>
                </Link>
              )}
              {nextCursor && (
                <Link
                  href={inventoryItemsUrl({ ...view, after: nextCursor })}
                  className="text-primary-400 hover:underline"
                >
                  <Typography variant="small" component="span">
                    Next page →
                  </Typography>
                </Link>
              )}
            </div>
          )}
        </Panel>
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
