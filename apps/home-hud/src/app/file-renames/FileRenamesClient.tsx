'use client';

import { useState } from 'react';
import {
  Badge,
  type BadgeColor,
  OutlinedButton,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Th,
  Td,
  Typography,
} from '@abbottland/fui-components';
import type { FileRename, FileRenameStatus } from './lib/video-api';

const fileRenameStatusColor: Record<FileRenameStatus, BadgeColor> = {
  pending: 'warning',
  applied: 'success',
  rejected: 'error',
};

const PAGE_SIZE = 10;

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

interface FileRenamesClientProps {
  fileRenames: FileRename[] | null;
}

export function FileRenamesClient({ fileRenames }: FileRenamesClientProps) {
  const [page, setPage] = useState(1);

  const totalPages = fileRenames
    ? Math.max(1, Math.ceil(fileRenames.length / PAGE_SIZE))
    : 1;
  const pageFileRenames = fileRenames?.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        File Renames
      </Typography>

      <div className="flex flex-col gap-4">
        {fileRenames === null && (
          <Typography variant="body1" className="text-error-400">
            Failed to load file renames from video-api.
          </Typography>
        )}
        {fileRenames?.length === 0 && (
          <Typography variant="body1">No rename suggestions yet.</Typography>
        )}
        {pageFileRenames && pageFileRenames.length > 0 && (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <Th>Original Path</Th>
                  <Th>Suggested Path</Th>
                  <Th>Source Titles</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Applied</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageFileRenames.map((fileRename) => (
                  <TableRow key={fileRename.id}>
                    <Td>{fileRename.originalFilePath}</Td>
                    <Td>{fileRename.suggestedFilePath}</Td>
                    <Td>
                      {fileRename.sourceTitleCardTitles?.length
                        ? fileRename.sourceTitleCardTitles.join(', ')
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>

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
