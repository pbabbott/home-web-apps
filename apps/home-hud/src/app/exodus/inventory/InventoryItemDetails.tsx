import { Typography } from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import { DECISION_LABELS, describeGit } from '../lib/inventory-display';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';
import { LocalDateTime } from '../lib/LocalDateTime';
import type { InventoryItem } from '../sources/lib/homelab-api';

function Line({
  label,
  icon,
  children,
}: {
  label: string;
  /** Shown in place of the label text. */
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <Typography variant="body2" className="break-words">
      {icon ? (
        <Icon
          name={icon}
          title={label}
          className="mr-1.5 inline-block align-text-bottom text-neutral-400"
        />
      ) : (
        <span className="text-neutral-400">{label}: </span>
      )}
      {children}
    </Typography>
  );
}

/** What the agent found and what was decided, as short labeled lines for the card. */
export function InventoryItemCompactDetails({
  inventoryItem,
}: {
  inventoryItem: InventoryItem;
}) {
  const { evidence } = inventoryItem;
  const facts = [
    evidence.contentKinds.join(', ') || 'unclassified',
    `reproducible: ${evidence.reproducible}`,
    `enough info: ${evidence.sufficientInformation ? 'yes' : 'no'}`,
    ...(evidence.estimatedSizeBytes !== undefined
      ? [formatBytes(evidence.estimatedSizeBytes)]
      : []),
    ...(evidence.estimatedFileCount !== undefined
      ? [`${evidence.estimatedFileCount} files`]
      : []),
  ];

  return (
    <div className="flex flex-col gap-1">
      <Line label="What">{inventoryItem.summary}</Line>
      <Line label="Why">
        {inventoryItem.recommendationReason}{' '}
        <span className="text-neutral-400">
          ({inventoryItem.recommendedBy ?? 'agent'},{' '}
          <LocalDateTime iso={inventoryItem.recommendedAt} />)
        </span>
      </Line>
      <Line label="Looks like" icon="radix-eye-open">
        {facts.join(' · ')}
      </Line>
      {evidence.git && (
        <Line label="Git">{describeGit(evidence.git).join(' · ')}</Line>
      )}
      {evidence.observations.length > 0 && (
        <Line label="Observed">{evidence.observations.join(' · ')}</Line>
      )}
      {evidence.openQuestions.length > 0 && (
        <Line label="Unknown">{evidence.openQuestions.join(' · ')}</Line>
      )}
      {inventoryItem.decision !== 'pending' && (
        <Line label="Decision">
          {DECISION_LABELS[inventoryItem.decision]}
          {inventoryItem.decidedBy ? ` by ${inventoryItem.decidedBy}` : ''}
          {inventoryItem.decidedAt && (
            <>
              {' on '}
              <LocalDateTime iso={inventoryItem.decidedAt} />
            </>
          )}
          {inventoryItem.decisionNote ? `: ${inventoryItem.decisionNote}` : ''}
        </Line>
      )}
    </div>
  );
}
