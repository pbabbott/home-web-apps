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

const PAGE_SIZE = 10;

const FIRST_SEASON = 1;
const LAST_SEASON = 13;
const SEASON_OPTIONS = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, i) => FIRST_SEASON + i,
);

/** Pulls the season number out of a `<Show>/Season <N>/<file>` filePath. */
function extractSeasonNumber(filePath: string): number | null {
  const match = filePath.match(/Season (\d+)/);
  return match ? Number(match[1]) : null;
}

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
}

export function TitleCardsClient({ titleCards }: TitleCardsClientProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredTitleCards = titleCards?.filter(
    (titleCard) =>
      selectedSeason === null ||
      extractSeasonNumber(titleCard.filePath) === selectedSeason,
  );

  const sortedTitleCards = filteredTitleCards
    ?.slice()
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  const totalPages = sortedTitleCards
    ? Math.max(1, Math.ceil(sortedTitleCards.length / PAGE_SIZE))
    : 1;
  const pageTitleCards = sortedTitleCards?.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  function selectSeason(season: number | null) {
    setSelectedSeason(season);
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

      <div className="self-start">
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
            {SEASON_OPTIONS.map((season) => (
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
        {titleCards?.length === 0 && (
          <Typography variant="body1">No title cards yet.</Typography>
        )}
        {titleCards &&
          titleCards.length > 0 &&
          filteredTitleCards?.length === 0 && (
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
                    <Th>Title</Th>
                    <Th>File Path</Th>
                    <Th>Timestamp (s)</Th>
                    <Th>Runtime (s)</Th>
                    <Th>Screenshot</Th>
                    <Th>Created</Th>
                    <Th>Actions</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageTitleCards.map((titleCard) => (
                    <TableRow key={titleCard.id}>
                      <Td>{titleCard.title ?? '—'}</Td>
                      <Td>{titleCard.filePath}</Td>
                      <Td>{titleCard.timestampSeconds}</Td>
                      <Td>{titleCard.runTimeSeconds ?? '—'}</Td>
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
