import type { ArrStats as Stats } from '../lib/homelab-api';
import { Row, Section } from './Section';
import { TimeValue } from './TimeValue';

interface ArrStatsProps {
  /** "Sonarr" or "Radarr", used in the heading. */
  name: string;
  stats: Stats | null;
}

/** Queue size plus the most recently obtained show (Sonarr) or movie (Radarr). */
export function ArrStats({ name, stats }: ArrStatsProps) {
  const last = stats?.lastImported ?? null;

  return (
    <Section title={`${name} Stats`} available={stats !== null}>
      <Row label="In queue">{stats?.queueCount ?? '—'}</Row>
      <Row label="Last obtained">
        {last ? (
          <>
            {last.title}
            {last.subtitle && (
              <>
                <br />
                {last.subtitle}
              </>
            )}
            {last.quality && (
              <>
                <br />
                {last.quality}
              </>
            )}
          </>
        ) : (
          '—'
        )}
      </Row>
      <Row label="When">
        <TimeValue iso={last?.importedAt} />
      </Row>
    </Section>
  );
}
