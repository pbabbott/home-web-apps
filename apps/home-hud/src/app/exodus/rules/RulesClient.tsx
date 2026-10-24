'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
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
import { LocalDateTime } from '../lib/LocalDateTime';
import { deleteExclusionRule } from '../sources/lib/actions';
import type { ExclusionRule } from '../sources/lib/homelab-api';
import { AddRuleModal } from './AddRuleModal';

interface RulesClientProps {
  /** Null if the sources could not be loaded. */
  sources: { id: string; name: string }[] | null;
  /** Null if the rules could not be loaded. */
  rules: ExclusionRule[] | null;
}

const SCOPE_LABELS = {
  exclude_subtree: 'exclude subtree',
  selective_only: 'selective only',
} as const;

export function RulesClient({ sources, rules }: RulesClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ExclusionRule | null>(null);
  const [toDelete, setToDelete] = useState<ExclusionRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sourceNames = new Map(sources?.map((s) => [s.id, s.name]));

  async function confirmDelete() {
    if (!toDelete) return;

    setDeleting(true);
    setDeleteError(null);

    const result = await deleteExclusionRule(toDelete.id);
    setDeleting(false);

    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }

    setToDelete(null);
    router.refresh();
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Typography variant="h1" component="h1">
            Exclusion Rules
          </Typography>
          <Typography variant="body2" className="text-neutral-400">
            Paths discovery should not go into or recommend. An exclude-subtree
            rule, global or per source, always wins.
          </Typography>
        </div>
        <Button
          size="small"
          disabled={sources === null}
          onClick={() => setAddOpen(true)}
        >
          Add Rule
        </Button>
      </div>

      {rules === null ? (
        <Typography variant="body2" className="text-error-400">
          Failed to load exclusion rules from homelab-api.
        </Typography>
      ) : rules.length === 0 ? (
        <Typography variant="body2" className="text-neutral-400">
          No rules yet.
        </Typography>
      ) : (
        <Panel color="default">
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Path</Th>
                  <Th>Scope</Th>
                  <Th>Applies to</Th>
                  <Th>Reason</Th>
                  <Th>Created</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <Td className="break-all">{rule.path}</Td>
                    <Td>
                      <Badge
                        color={
                          rule.scope === 'exclude_subtree'
                            ? 'error'
                            : 'secondary'
                        }
                      >
                        {SCOPE_LABELS[rule.scope]}
                      </Badge>
                    </Td>
                    <Td>
                      {rule.sourceId === null
                        ? 'All sources'
                        : (sourceNames.get(rule.sourceId) ?? 'Unknown source')}
                    </Td>
                    <Td>{rule.reason ?? '—'}</Td>
                    <Td>
                      <LocalDateTime iso={rule.createdAt} />
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <OutlinedButton
                          size="small"
                          onClick={() => setEditing(rule)}
                        >
                          Edit
                        </OutlinedButton>
                        <OutlinedButton
                          size="small"
                          onClick={() => {
                            setDeleteError(null);
                            setToDelete(rule);
                          }}
                        >
                          Remove
                        </OutlinedButton>
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        </Panel>
      )}

      <AddRuleModal
        open={addOpen}
        onOpenChange={setAddOpen}
        sources={sources ?? []}
        onSaved={() => router.refresh()}
      />

      <AddRuleModal
        key={editing?.id ?? 'edit'}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        sources={sources ?? []}
        rule={editing}
        onSaved={() => router.refresh()}
      />

      <Modal
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <ModalContent color="secondary">
          <ModalTitle>Remove rule?</ModalTitle>
          <ModalDescription>
            {toDelete?.path} will no longer be excluded. Directories already
            skipped stay skipped; nothing is deleted.
          </ModalDescription>
          {deleteError && (
            <Typography variant="body2" className="mt-4 text-error-400">
              {deleteError}
            </Typography>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <OutlinedButton
              size="small"
              disabled={deleting}
              onClick={() => setToDelete(null)}
            >
              Keep
            </OutlinedButton>
            <Button size="small" disabled={deleting} onClick={confirmDelete}>
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </main>
  );
}
