'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Badge,
  type BadgeColor,
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
import { deleteFileRename, deleteFileRenamesForSeason } from './lib/actions';
import type { FileRename, FileRenameStatus } from './lib/video-api';

const fileRenameStatusColor: Record<FileRenameStatus, BadgeColor> = {
  pending: 'warning',
  applied: 'success',
  rejected: 'error',
};

const STATUS_OPTIONS: FileRenameStatus[] = ['pending', 'applied', 'rejected'];

const PAGE_SIZE = 10;

const FIRST_SEASON = 1;
const LAST_SEASON = 13;
const SEASON_OPTIONS = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, i) => FIRST_SEASON + i,
);

/** Pulls the season number out of a `<Show>/Season <N>/<file>` path. */
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

// mm:ss(.s) — a whole-number of seconds renders without a decimal, a
// refined (fractional) split point keeps its one decimal place.
function formatSplitAt(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds - minutes * 60;
  const secondsText = Number.isInteger(remainingSeconds)
    ? String(remainingSeconds).padStart(2, '0')
    : remainingSeconds.toFixed(1).padStart(4, '0');

  return `${minutes}:${secondsText}`;
}

interface FileRenamesClientProps {
  fileRenames: FileRename[] | null;
}

export function FileRenamesClient({ fileRenames }: FileRenamesClientProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<FileRenameStatus | null>(
    null,
  );
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowDeleting, setRowDeleting] = useState(false);
  const [rowDeleteError, setRowDeleteError] = useState<string | null>(null);

  const filteredFileRenames = fileRenames
    ?.filter(
      (fileRename) =>
        (selectedSeason === null ||
          extractSeasonNumber(fileRename.originalFilePath) ===
            selectedSeason) &&
        (selectedStatus === null || fileRename.status === selectedStatus),
    )
    .sort((a, b) => a.originalFilePath.localeCompare(b.originalFilePath));

  const totalPages = filteredFileRenames
    ? Math.max(1, Math.ceil(filteredFileRenames.length / PAGE_SIZE))
    : 1;
  const pageFileRenames = filteredFileRenames?.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  function selectSeason(season: number | null) {
    setSelectedSeason(season);
    setPage(1);
  }

  function selectStatus(status: FileRenameStatus | null) {
    setSelectedStatus(status);
    setPage(1);
  }

  async function handleDeleteFileRename(id: string) {
    setRowDeleting(true);
    setRowDeleteError(null);

    try {
      await deleteFileRename(id);
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      setRowDeleteError(
        err instanceof Error ? err.message : 'Failed to delete file rename',
      );
    } finally {
      setRowDeleting(false);
    }
  }

  async function deleteSeason() {
    if (selectedSeason === null) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteFileRenamesForSeason(selectedSeason);
      setDeleteModalOpen(false);
      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete file renames',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        File Renames
      </Typography>

      <div className="flex flex-col gap-2 self-start">
        <div className="flex items-center gap-4">
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

          <DropdownMenu open={statusMenuOpen} onOpenChange={setStatusMenuOpen}>
            <DropdownMenuTrigger asChild>
              <OutlinedButton size="small">
                Status: {selectedStatus ?? 'All'}
              </OutlinedButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent label="Filter by Status">
              <DropdownMenuItem onSelect={() => selectStatus(null)}>
                All Statuses
              </DropdownMenuItem>
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => selectStatus(status)}
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedSeason !== null && (
            <Modal open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
              <ModalTrigger asChild>
                <Button size="small" color="error">
                  Delete Season {selectedSeason}
                </Button>
              </ModalTrigger>
              <ModalContent color="secondary">
                <ModalTitle>Delete Season {selectedSeason}?</ModalTitle>
                <ModalDescription>
                  This permanently deletes every file-rename suggestion for
                  Season {selectedSeason}. This cannot be undone.
                </ModalDescription>
                <div className="mt-4 flex justify-end gap-3">
                  <OutlinedButton
                    size="small"
                    disabled={deleting}
                    onClick={() => setDeleteModalOpen(false)}
                  >
                    Cancel
                  </OutlinedButton>
                  <Button
                    size="small"
                    color="error"
                    disabled={deleting}
                    onClick={() => void deleteSeason()}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </ModalContent>
            </Modal>
          )}
        </div>
        {deleteError && (
          <Typography variant="body2" className="text-error-400">
            {deleteError}
          </Typography>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {fileRenames === null && (
          <Typography variant="body1" className="text-error-400">
            Failed to load file renames from video-api.
          </Typography>
        )}
        {rowDeleteError && (
          <Typography variant="body2" className="text-error-400">
            {rowDeleteError}
          </Typography>
        )}
        {fileRenames?.length === 0 && (
          <Typography variant="body1">No rename suggestions yet.</Typography>
        )}
        {fileRenames &&
          fileRenames.length > 0 &&
          filteredFileRenames?.length === 0 && (
            <Typography variant="body1">
              No rename suggestions match the current filters.
            </Typography>
          )}
        {pageFileRenames && pageFileRenames.length > 0 && (
          <>
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Original Path</Th>
                    <Th>Source Titles</Th>
                    <Th>Suggested Path</Th>
                    <Th>Split At</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th>Applied</Th>
                    <Th>Actions</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageFileRenames.map((fileRename) => (
                    <TableRow key={fileRename.id}>
                      <Td>{fileRename.originalFilePath}</Td>
                      <Td>
                        {fileRename.sourceTitleCardTitles?.length ? (
                          <div className="flex flex-col gap-1">
                            {fileRename.sourceTitleCardTitles.map(
                              (title, i) => (
                                <span key={i}>{title}</span>
                              ),
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>
                        {fileRename.secondSuggestedFilePath ? (
                          <div className="flex flex-col gap-1">
                            <span>{fileRename.suggestedFilePath}</span>
                            <span>{fileRename.secondSuggestedFilePath}</span>
                          </div>
                        ) : (
                          fileRename.suggestedFilePath
                        )}
                      </Td>
                      <Td>
                        {fileRename.splitAtSeconds !== null
                          ? formatSplitAt(fileRename.splitAtSeconds)
                          : '—'}
                      </Td>
                      <Td>
                        <Badge color={fileRenameStatusColor[fileRename.status]}>
                          {fileRename.status}
                        </Badge>
                      </Td>
                      <Td>{formatDate(fileRename.createdAt)}</Td>
                      <Td>
                        {fileRename.appliedAt
                          ? formatDate(fileRename.appliedAt)
                          : '—'}
                      </Td>
                      <Td>
                        <Modal
                          open={confirmDeleteId === fileRename.id}
                          onOpenChange={(open) =>
                            setConfirmDeleteId(open ? fileRename.id : null)
                          }
                        >
                          <ModalTrigger asChild>
                            <Button size="small" color="error">
                              Delete
                            </Button>
                          </ModalTrigger>
                          <ModalContent color="secondary">
                            <ModalTitle>
                              Delete this rename suggestion?
                            </ModalTitle>
                            <ModalDescription>
                              Permanently deletes the rename suggestion for{' '}
                              {fileRename.originalFilePath}. This cannot be
                              undone.
                            </ModalDescription>
                            <div className="mt-4 flex justify-end gap-3">
                              <OutlinedButton
                                size="small"
                                disabled={rowDeleting}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </OutlinedButton>
                              <Button
                                size="small"
                                color="error"
                                disabled={rowDeleting}
                                onClick={() =>
                                  void handleDeleteFileRename(fileRename.id)
                                }
                              >
                                {rowDeleting ? 'Deleting…' : 'Delete'}
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
