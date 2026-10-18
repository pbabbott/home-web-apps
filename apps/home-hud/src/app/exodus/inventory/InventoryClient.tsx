'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
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
import {
  formatBytes,
  inventoryUrl,
  pathCrumbs,
  type InventoryTypeFilter,
} from '../lib/inventory-display';
import { formatDateTime } from '../lib/job-display';
import type { InventoryItem } from '../sources/lib/homelab-api';

interface InventoryClientProps {
  /** Null if the sources could not be loaded. */
  sources: { id: string; name: string }[] | null;
  /** The source being browsed; null if there are none. */
  sourceId: string | null;
  /** Where the latest job started; null if the source has never been explored. */
  rootPath: string | null;
  currentPath: string | null;
  recursive: boolean;
  type: InventoryTypeFilter | undefined;
  isFirstPage: boolean;
  /** Null if the inventory could not be loaded. */
  items: InventoryItem[] | null;
  nextCursor: string | null;
}

const selectClass =
  'border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0';

export function InventoryClient({
  sources,
  sourceId,
  rootPath,
  currentPath,
  recursive,
  type,
  isFirstPage,
  items,
  nextCursor,
}: InventoryClientProps) {
  const router = useRouter();

  const view = {
    source: sourceId ?? undefined,
    path: currentPath ?? undefined,
    recursive,
    type,
  };
  const crumbs =
    rootPath && currentPath ? pathCrumbs(rootPath, currentPath) : [];

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <Typography variant="h1" component="h1">
          Inventory
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Files and directories found on each source.
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
          to start collecting an inventory.
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
                router.push(inventoryUrl({ source: e.target.value }))
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

      {sourceId === null ? null : currentPath === null ? (
        <Typography variant="body2" className="text-neutral-400">
          Nothing to browse yet. Start a discovery job for this source first.
        </Typography>
      ) : (
        <Panel color="default" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Folder"
              className="flex flex-wrap items-center gap-1"
            >
              {crumbs.map((crumb, index) => (
                <span key={crumb.path} className="flex items-center gap-1">
                  {index > 0 && (
                    <Typography
                      variant="small"
                      component="span"
                      className="text-neutral-500"
                    >
                      ›
                    </Typography>
                  )}
                  {index === crumbs.length - 1 ? (
                    <Typography
                      variant="small"
                      component="span"
                      className="break-all"
                    >
                      {crumb.label}
                    </Typography>
                  ) : (
                    <Link
                      href={inventoryUrl({
                        ...view,
                        path: crumb.path,
                      })}
                      className="break-all text-primary-400 hover:underline"
                    >
                      <Typography variant="small" component="span">
                        {crumb.label}
                      </Typography>
                    </Link>
                  )}
                </span>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <Typography variant="small" className="text-neutral-400">
                  Show
                </Typography>
                <select
                  value={recursive ? 'all' : 'children'}
                  onChange={(e) =>
                    router.push(
                      inventoryUrl({
                        ...view,
                        recursive: e.target.value === 'all',
                      }),
                    )
                  }
                  className={selectClass}
                >
                  <option value="children">This folder</option>
                  <option value="all">Everything beneath it</option>
                </select>
              </label>

              <label className="flex items-center gap-2">
                <Typography variant="small" className="text-neutral-400">
                  Type
                </Typography>
                <select
                  value={type ?? ''}
                  onChange={(e) =>
                    router.push(
                      inventoryUrl({
                        ...view,
                        type:
                          e.target.value === 'file' ||
                          e.target.value === 'directory'
                            ? e.target.value
                            : undefined,
                      }),
                    )
                  }
                  className={selectClass}
                >
                  <option value="">Files and folders</option>
                  <option value="file">Files</option>
                  <option value="directory">Folders</option>
                </select>
              </label>
            </div>
          </div>

          {items === null ? (
            <Typography variant="body2" className="text-error-400">
              Failed to load inventory from homelab-api. Check that the path is
              a valid absolute Windows path.
            </Typography>
          ) : items.length === 0 ? (
            <Typography variant="body2" className="text-neutral-400">
              {isFirstPage ? 'Nothing recorded here yet.' : 'No more items.'}
            </Typography>
          ) : (
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>{recursive ? 'Path' : 'Name'}</Th>
                    <Th>Type</Th>
                    <Th>Size</Th>
                    <Th>Modified (UTC)</Th>
                    <Th>Last seen (UTC)</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <Td className="break-all">
                        {item.itemType === 'directory' ? (
                          <Link
                            href={inventoryUrl({
                              ...view,
                              path: item.path,
                            })}
                            className="text-primary-400 hover:underline"
                          >
                            {recursive ? item.path : item.name}
                          </Link>
                        ) : recursive ? (
                          item.path
                        ) : (
                          item.name
                        )}
                      </Td>
                      <Td>
                        <Badge
                          color={
                            item.itemType === 'directory' ? 'secondary' : 'dark'
                          }
                        >
                          {item.itemType === 'directory' ? 'folder' : 'file'}
                        </Badge>
                      </Td>
                      <Td>{formatBytes(item.sizeBytes)}</Td>
                      <Td>{formatDateTime(item.modifiedAt)}</Td>
                      <Td>{formatDateTime(item.lastSeenAt)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}

          {items !== null && (!isFirstPage || nextCursor) && (
            <div className="flex items-center justify-between gap-3">
              {isFirstPage ? (
                <span />
              ) : (
                <Link
                  href={inventoryUrl(view)}
                  className="text-primary-400 hover:underline"
                >
                  <Typography variant="small" component="span">
                    ← First page
                  </Typography>
                </Link>
              )}
              {nextCursor && (
                <Link
                  href={inventoryUrl({ ...view, after: nextCursor })}
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
    </main>
  );
}
