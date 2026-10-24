import { Typography } from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import { DECISION_LABELS, describeGit } from '../lib/inventory-display';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';
import { LocalDateTime } from '../lib/LocalDateTime';
import type { InventoryItem } from '../sources/lib/homelab-api';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Typography variant="body1" className="text-neutral-400">
        {title}
      </Typography>
      {children}
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length === 0 ? (
    <Typography variant="body2" className="text-neutral-400">
      {empty}
    </Typography>
  ) : (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {items.map((item) => (
        <li key={item}>
          <Typography variant="body2" component="span" className="break-words">
            {item}
          </Typography>
        </li>
      ))}
    </ul>
  );
}

/** What the agent found and what was decided; shared by the detail modal and the card view. */
export function InventoryItemDetails({
  inventoryItem,
}: {
  inventoryItem: InventoryItem;
}) {
  const { evidence } = inventoryItem;

  return (
    <>
      <Section title="Summary">
        <Typography variant="body2">{inventoryItem.summary}</Typography>
      </Section>

      <Section title="Why the agent recommends this">
        <Typography variant="body2">
          {inventoryItem.recommendationReason}
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          {inventoryItem.recommendedBy ?? 'agent'}, updated{' '}
          <LocalDateTime iso={inventoryItem.recommendedAt} />
        </Typography>
      </Section>

      <Section title="Observations">
        <List items={evidence.observations} empty="None recorded." />
      </Section>

      {evidence.openQuestions.length > 0 && (
        <Section title="Still unknown">
          <List items={evidence.openQuestions} empty="" />
        </Section>
      )}

      {evidence.git && (
        <Section title="Git">
          <List items={describeGit(evidence.git)} empty="" />
        </Section>
      )}

      <Section title="Other">
        <List
          items={[
            `Looks like: ${evidence.contentKinds.join(', ') || 'unclassified'}`,
            `Reproducible elsewhere: ${evidence.reproducible}`,
            `Enough information: ${evidence.sufficientInformation ? 'yes' : 'no'}`,
            ...(evidence.estimatedSizeBytes !== undefined
              ? [`Estimated size: ${formatBytes(evidence.estimatedSizeBytes)}`]
              : []),
            ...(evidence.estimatedFileCount !== undefined
              ? [`Estimated files: ${evidence.estimatedFileCount}`]
              : []),
          ]}
          empty=""
        />
      </Section>

      {inventoryItem.decision !== 'pending' && (
        <Section title="Decision">
          <Typography variant="body2">
            {DECISION_LABELS[inventoryItem.decision]}
            {inventoryItem.decidedBy ? ` by ${inventoryItem.decidedBy}` : ''}
            {inventoryItem.decidedAt && (
              <>
                {' on '}
                <LocalDateTime iso={inventoryItem.decidedAt} />
              </>
            )}
            {inventoryItem.decisionNote
              ? `: ${inventoryItem.decisionNote}`
              : ''}
          </Typography>
        </Section>
      )}
    </>
  );
}

function Line({
  label,
  icon,
  children,
}: {
  label: string;
  /** Shown in place of the label text, as the table does for "Looks like". */
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

/** The same facts as `InventoryItemDetails`, packed into short labeled lines for the card view. */
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
