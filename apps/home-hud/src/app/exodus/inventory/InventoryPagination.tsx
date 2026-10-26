import Link from 'next/link';
import { Typography } from '@abbottland/fui-components';
import {
  inventoryItemsUrl,
  pageNumbers,
  type InventoryItemView,
} from '../lib/inventory-display';

interface InventoryPaginationProps {
  /** The current view; its `page` is replaced by each link. */
  view: InventoryItemView;
  page: number;
  pageSize: number;
  total: number;
  /** How many items this page shows. */
  shown: number;
}

const linkClass = 'text-primary-400 hover:underline';

export function InventoryPagination({
  view,
  page,
  pageSize,
  total,
  shown,
}: InventoryPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = shown === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = (page - 1) * pageSize + shown;
  const pageUrl = (n: number) => inventoryItemsUrl({ ...view, page: n });

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
      <Typography variant="small">
        {total === 0
          ? '0 inventory items'
          : `Showing ${first}–${last} of ${total}`}
      </Typography>

      {totalPages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center gap-3">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className={linkClass}>
              <Typography variant="small" component="span">
                ← Previous
              </Typography>
            </Link>
          )}
          {pageNumbers(page, totalPages).map((n, i) =>
            n === 'gap' ? (
              <Typography key={`gap-${i}`} variant="small" component="span">
                …
              </Typography>
            ) : n === page ? (
              <Typography
                key={n}
                variant="small"
                component="span"
                aria-current="page"
              >
                {n}
              </Typography>
            ) : (
              <Link key={n} href={pageUrl(n)} className={linkClass}>
                <Typography variant="small" component="span">
                  {n}
                </Typography>
              </Link>
            ),
          )}
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className={linkClass}>
              <Typography variant="small" component="span">
                Next →
              </Typography>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
