'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  ModalTrigger,
  OutlinedButton,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Th,
  Td,
  Typography,
} from '@abbottland/fui-components';
import { deleteTitleCard } from './lib/actions';
import type { TitleCard } from './lib/video-api';
import type { Series } from '../series/lib/video-api';

const PAGE_SIZE = 10;

const FIRST_SEASON = 1;
const DEFAULT_LAST_SEASON = 13;

// Fixed locale/timeZone so server and client render identical text — a
// locale-dependent format (e.g. toLocaleString()) mismatches across the
// SSR/hydration boundary whenever the server and browser timezones differ.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

interface TitleCardsClientProps {
  titleCards: TitleCard[] | null;
  selectedSeason: number | null;
  selectedSeries: string | null;
  series: Series[];
}

export function TitleCardsClient({
  titleCards,
  selectedSeason,
  selectedSeries,
  series,
}: TitleCardsClientProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [seriesMenuOpen, setSeriesMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectedSeriesRow = series.find((s) => s.seriesName === selectedSeries);
  const lastSeason = selectedSeriesRow?.seasonCount ?? DEFAULT_LAST_SEASON;
  const seasonOptions = Array.from(
    { length: Math.max(1, lastSeason - FIRST_SEASON + 1) },
    (_, i) => FIRST_SEASON + i,
  );

  const sortedTitleCards = titleCards
    ?.slice()
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  const totalPages = sortedTitleCards
    ? Math.max(1, Math.ceil(sortedTitleCards.length / PAGE_SIZE))
    : 1;
  const pageTitleCards = sortedTitleCards?.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // Both filters live in the URL together — build it from URLSearchParams
  // rather than a hardcoded single-param string, so changing one filter
  // never drops the other.
  function buildFilterUrl(
    season: number | null,
    seriesName: string | null,
  ): string {
    const params = new URLSearchParams();
    if (season !== null) params.set('season', String(season));
    if (seriesName !== null) params.set('series', seriesName);

    const query = params.toString();
    return query ? `/video/title-cards?${query}` : '/video/title-cards';
  }

  function selectSeason(season: number | null) {
    router.push(buildFilterUrl(season, selectedSeries));
    setPage(1);
  }

  function selectSeries(seriesName: string | null) {
    router.push(buildFilterUrl(selectedSeason, seriesName));
    setPage(1);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteTitleCard(id);
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete title card',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Title Cards
      </Typography>

      <div className="flex items-center gap-3 self-start">
        <DropdownMenu open={seriesMenuOpen} onOpenChange={setSeriesMenuOpen}>
          <DropdownMenuTrigger asChild>
            <OutlinedButton size="small">
              Series: {selectedSeries ?? 'All'}
            </OutlinedButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Filter by Series">
            <DropdownMenuItem onSelect={() => selectSeries(null)}>
              All Series
            </DropdownMenuItem>
            {series.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => selectSeries(s.seriesName)}
              >
                {s.seriesName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={seasonMenuOpen} onOpenChange={setSeasonMenuOpen}>
          <DropdownMenuTrigger asChild>
            <OutlinedButton size="small">
              Season: {selectedSeason ?? 'All'}
            </OutlinedButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Filter by Season">
            <DropdownMenuItem onSelect={() => selectSeason(null)}>
              All Seasons
            </DropdownMenuItem>
            {seasonOptions.map((season) => (
              <DropdownMenuItem
                key={season}
                onSelect={() => selectSeason(season)}
              >
                Season {season}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-4">
        {deleteError && (
          <Typography variant="body2" className="text-error-400">
            {deleteError}
          </Typography>
        )}
        {titleCards === null && (
          <Typography variant="body1" className="text-error-400">
            Failed to load title cards from video-api.
          </Typography>
        )}
        {titleCards?.length === 0 && selectedSeason === null && (
          <Typography variant="body1">No title cards yet.</Typography>
        )}
        {titleCards?.length === 0 && selectedSeason !== null && (
          <Typography variant="body1">
            No title cards for Season {selectedSeason}.
          </Typography>
        )}
        {pageTitleCards && pageTitleCards.length > 0 && (
          <>
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Screenshot</Th>
                    <Th>Title</Th>
                    <Th>File Path</Th>
                    <Th>Timestamp (s)</Th>
                    <Th>Runtime (s)</Th>
                    <Th>Created</Th>
                    <Th>Actions</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageTitleCards.map((titleCard) => (
                    <TableRow key={titleCard.id}>
                      <Td>
                        {titleCard.screenshotBase64 ? (
                          <Modal>
                            <ModalTrigger asChild>
                              <button type="button" className="cursor-pointer">
                                <img
                                  src={`data:image/jpeg;base64,${titleCard.screenshotBase64}`}
                                  alt={`Screenshot at ${titleCard.timestampSeconds}s for ${titleCard.title ?? titleCard.filePath}`}
                                  className="h-16 w-auto border border-neutral-500"
                                />
                              </button>
                            </ModalTrigger>
                            <ModalContent color="secondary">
                              <ModalTitle>
                                {titleCard.title ?? 'No title detected'}
                              </ModalTitle>
                              <img
                                src={`data:image/jpeg;base64,${titleCard.screenshotBase64}`}
                                alt={`Screenshot at ${titleCard.timestampSeconds}s for ${titleCard.title ?? titleCard.filePath}`}
                                className="mt-4 w-full"
                              />
                            </ModalContent>
                          </Modal>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>{titleCard.title ?? '—'}</Td>
                      <Td>{titleCard.filePath}</Td>
                      <Td>{titleCard.timestampSeconds}</Td>
                      <Td>{titleCard.runTimeSeconds ?? '—'}</Td>
                      <Td>{formatDate(titleCard.createdAt)}</Td>
                      <Td>
                        <Modal
                          open={confirmDeleteId === titleCard.id}
                          onOpenChange={(open) =>
                            setConfirmDeleteId(open ? titleCard.id : null)
                          }
                        >
                          <ModalTrigger asChild>
                            <Button size="small" color="error">
                              Delete
                            </Button>
                          </ModalTrigger>
                          <ModalContent color="secondary">
                            <ModalTitle>Delete this title card?</ModalTitle>
                            <ModalDescription>
                              Permanently deletes the record for{' '}
                              {titleCard.title ?? 'this title card'} at{' '}
                              {titleCard.timestampSeconds}s. The episode becomes
                              eligible for title-card detection again on the
                              next job run. This cannot be undone.
                            </ModalDescription>
                            <div className="mt-4 flex justify-end gap-3">
                              <OutlinedButton
                                size="small"
                                disabled={deleting}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </OutlinedButton>
                              <Button
                                size="small"
                                color="error"
                                disabled={deleting}
                                onClick={() => void handleDelete(titleCard.id)}
                              >
                                {deleting ? 'Deleting…' : 'Delete'}
                              </Button>
                            </div>
                          </ModalContent>
                        </Modal>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>

            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-4">
                <OutlinedButton
                  size="small"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </OutlinedButton>
                <Typography variant="body2">
                  Page {page} of {totalPages}
                </Typography>
                <OutlinedButton
                  size="small"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </OutlinedButton>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
