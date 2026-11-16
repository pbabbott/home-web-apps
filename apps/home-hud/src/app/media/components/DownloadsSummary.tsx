import type { DownloadsSummary as Summary } from '../lib/homelab-api';
import { formatSpeed } from '../lib/display';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';
import { Row, Section } from './Section';

interface DownloadsSummaryProps {
  summary: Summary | null;
}

const orDash = (
  value: number | null,
  format: (n: number) => string = String,
) => (value === null ? '—' : format(value));

export function DownloadsSummary({ summary }: DownloadsSummaryProps) {
  const s = summary;

  return (
    <Section title="Summary" available={s !== null}>
      <Row label="Download speed">
        {orDash(s?.downloadSpeed ?? null, formatSpeed)}
      </Row>
      <Row label="Upload speed">
        {orDash(s?.uploadSpeed ?? null, formatSpeed)}
      </Row>
      <Row label="Active torrents">{orDash(s?.activeTorrents ?? null)}</Row>
      <Row label="Sonarr queue">{orDash(s?.sonarrQueue ?? null)}</Row>
      <Row label="Radarr queue">{orDash(s?.radarrQueue ?? null)}</Row>
      <Row label="Free on media share">
        {orDash(s?.diskAvailableBytes ?? null, formatBytes)}
      </Row>
    </Section>
  );
}
