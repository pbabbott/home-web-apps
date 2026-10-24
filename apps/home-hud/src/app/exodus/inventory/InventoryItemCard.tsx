import {
  Badge,
  Button,
  Card,
  Input,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import {
  changedSinceDecision,
  DECISION_CARD_COLOR,
  DECISION_COLOR,
  DECISION_LABELS,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
} from '../lib/inventory-display';
import type {
  InventoryItem,
  InventoryItemDecision,
} from '../sources/lib/homelab-api';
import { PreviewButton } from '../lib/PreviewButton';
import { InventoryItemCompactDetails } from './InventoryItemDetails';

interface InventoryItemCardProps {
  inventoryItem: InventoryItem;
  note: string;
  onNoteChange: (note: string) => void;
  busy: boolean;
  onDecide: (decision: InventoryItemDecision) => void;
}

/** One inventory item with everything the detail modal shows, colored by the agent's recommendation. */
export function InventoryItemCard({
  inventoryItem,
  note,
  onNoteChange,
  busy,
  onDecide,
}: InventoryItemCardProps) {
  const isFile = inventoryItem.kind === 'file';

  return (
    <Card
      color={DECISION_CARD_COLOR[inventoryItem.decision]}
      className="flex flex-col gap-2 !p-3"
    >
      <div className="flex flex-col">
        <Typography variant="body1" className="break-all">
          <Icon
            name={isFile ? 'radix-file' : 'folder'}
            title={isFile ? 'File' : 'Folder'}
            className="mr-1.5 inline-block align-text-bottom text-neutral-400"
          />
          {inventoryItem.displayName}
        </Typography>
        <Typography variant="body2" className="break-all text-neutral-400">
          {inventoryItem.rootPath}
          {isFile && (
            <PreviewButton
              sourceId={inventoryItem.sourceId}
              path={inventoryItem.rootPath}
              className="ml-1 align-text-bottom"
            />
          )}
        </Typography>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Badge color={RECOMMENDATION_COLOR[inventoryItem.recommendation]}>
          {RECOMMENDATION_LABELS[inventoryItem.recommendation]} (
          {inventoryItem.confidence})
        </Badge>
        {inventoryItem.decision === 'rejected' && (
          <Badge color={DECISION_COLOR[inventoryItem.decision]}>
            {DECISION_LABELS[inventoryItem.decision]}
          </Badge>
        )}
        {changedSinceDecision(inventoryItem) && (
          <Badge color="warning">Agent changed</Badge>
        )}
      </div>

      <InventoryItemCompactDetails inventoryItem={inventoryItem} />

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Input
          color="primary"
          className="min-w-40 flex-1"
          placeholder="Reason (optional)"
          aria-label={`Reason for ${inventoryItem.displayName}`}
          maxLength={1000}
          disabled={busy}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />
        {inventoryItem.decision !== 'approved' && (
          <Button
            size="small"
            disabled={busy}
            onClick={() => onDecide('approved')}
          >
            Approve
          </Button>
        )}
        {inventoryItem.decision !== 'rejected' && (
          <OutlinedButton
            size="small"
            color="error"
            disabled={busy}
            onClick={() => onDecide('rejected')}
          >
            Reject
          </OutlinedButton>
        )}
        {inventoryItem.decision !== 'pending' && (
          <OutlinedButton
            size="small"
            disabled={busy}
            onClick={() => onDecide('pending')}
          >
            Reset
          </OutlinedButton>
        )}
      </div>
    </Card>
  );
}
