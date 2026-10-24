'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import type { Host } from '../../infra/hosts/lib/homelab-api';
import { LocalDateTime } from '../lib/LocalDateTime';
import { AddSourceModal } from './AddSourceModal';
import type { Source } from './lib/homelab-api';

interface SourcesClientProps {
  sources: Source[] | null;
  hosts: Host[] | null;
}

export function SourcesClient({ sources, hosts }: SourcesClientProps) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);

  const hostsById = new Map((hosts ?? []).map((host) => [host.id, host]));

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Sources
      </Typography>

      <Panel color="default" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Typography variant="body2" className="text-neutral-400">
            Machines being inventoried for the exodus file migration.
          </Typography>
          <OutlinedButton
            size="small"
            disabled={hosts === null}
            onClick={() => setAddModalOpen(true)}
          >
            + Add Source
          </OutlinedButton>
        </div>

        {sources === null ? (
          <Typography variant="body2" className="text-error-400">
            Failed to load sources from homelab-api.
          </Typography>
        ) : sources.length === 0 ? (
          <Typography variant="body2" className="text-neutral-400">
            No sources yet.
          </Typography>
        ) : (
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Name</Th>
                  <Th>Host</Th>
                  <Th>Type</Th>
                  <Th>Created</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {sources.map((source) => {
                  const host = source.hostId
                    ? hostsById.get(source.hostId)
                    : undefined;

                  return (
                    <TableRow key={source.id}>
                      <Td>
                        <Link
                          href={`/exodus/sources/${source.id}`}
                          className="text-primary-400 hover:underline"
                        >
                          {source.name}
                        </Link>
                      </Td>
                      <Td>{host ? `${host.name} (${host.ipAddress})` : '—'}</Td>
                      <Td>
                        <Badge color="dark">{source.sourceType}</Badge>
                      </Td>
                      <Td>
                        <LocalDateTime iso={source.createdAt} dateOnly />
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollableTable>
        )}

        {hosts === null && (
          <Typography variant="body2" className="text-error-400">
            Failed to load hosts, so sources cannot be added right now.
          </Typography>
        )}
      </Panel>

      <AddSourceModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        hosts={hosts ?? []}
        onSaved={() => router.refresh()}
      />
    </main>
  );
}
