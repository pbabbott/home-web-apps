import type { ReviewDisposition } from '../sources/lib/homelab-api';

export type InventoryTypeFilter = 'file' | 'directory';

export const REVIEW_LABELS: Record<ReviewDisposition, string> = {
  candidate: 'Candidate',
  not_needed: 'Not needed',
  needs_review: 'Needs review',
};

/** A review filter from a URL parameter; anything else means "all". */
export function parseReview(
  value: string | undefined,
): ReviewDisposition | undefined {
  return value === 'candidate' ||
    value === 'not_needed' ||
    value === 'needs_review'
    ? value
    : undefined;
}

export interface Crumb {
  label: string;
  path: string;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Human size with binary units, e.g. `1.5 KB`; an em dash when unknown (directories). */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';

  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${UNITS[unit]}`;
}

/**
 * Single backslashes and no trailing separator (a drive root keeps its `\`).
 * Mirrors the API's normalization closely enough to compare and walk paths;
 * the API stays the authority on what is valid.
 */
export function tidyPath(path: string): string {
  const slashed = path.trim().replace(/\//g, '\\');
  const unc = slashed.startsWith('\\\\');
  const collapsed =
    (unc ? '\\\\' : '') + slashed.slice(unc ? 2 : 0).replace(/\\+/g, '\\');

  return collapsed.length > 1 &&
    collapsed.endsWith('\\') &&
    !/^[A-Za-z]:\\$/.test(collapsed)
    ? collapsed.slice(0, -1)
    : collapsed;
}

/** True if `child` is `parent` or beneath it, comparing case-insensitively on directory boundaries. */
export function isWithinPath(parent: string, child: string): boolean {
  const p = tidyPath(parent).toLowerCase();
  const c = tidyPath(child).toLowerCase();

  if (c === p) return true;

  return c.startsWith(p.endsWith('\\') ? p : `${p}\\`);
}

/** The drive (`C:\`) or share (`\\server\share`) a path starts at, or null if neither. */
function pathHead(path: string): string | null {
  return (
    path.match(/^[A-Za-z]:\\/)?.[0] ??
    path.match(/^\\\\[^\\]+\\[^\\]+/)?.[0] ??
    null
  );
}

/**
 * Clickable trail for `path`. When the path is inside `rootPath` the trail
 * starts at the root (there is nothing above it to see); otherwise it starts
 * at the drive or share.
 */
export function pathCrumbs(rootPath: string, path: string): Crumb[] {
  const current = tidyPath(path);
  const root = tidyPath(rootPath);
  const start = isWithinPath(root, current) ? root : pathHead(current);

  if (start === null) return [{ label: current, path: current }];

  const crumbs: Crumb[] = [{ label: start, path: start }];
  const rest = current
    .slice(start.length)
    .split('\\')
    .filter((segment) => segment !== '');

  let walked = start;
  for (const segment of rest) {
    walked = walked.endsWith('\\') ? walked + segment : `${walked}\\${segment}`;
    crumbs.push({ label: segment, path: walked });
  }

  return crumbs;
}

export interface InventoryView {
  /** Source whose inventory is shown. */
  source?: string;
  /** Directory being browsed; the page falls back to the job root when absent. */
  path?: string;
  /** List every descendant instead of only direct children. */
  recursive?: boolean;
  type?: InventoryTypeFilter;
  review?: ReviewDisposition;
  /** Keyset cursor from the previous page. */
  after?: string;
}

const INVENTORY_PATH = '/exodus/inventory';

/** Page URL for a view; defaults are left out so URLs stay short and shareable. */
export function inventoryUrl(view: InventoryView): string {
  const params = new URLSearchParams();

  if (view.source) params.set('source', view.source);
  if (view.path) params.set('path', view.path);
  if (view.recursive) params.set('recursive', '1');
  if (view.type) params.set('type', view.type);
  if (view.review) params.set('review', view.review);
  if (view.after) params.set('after', view.after);

  const query = params.toString();

  return query ? `${INVENTORY_PATH}?${query}` : INVENTORY_PATH;
}
