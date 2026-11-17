import { Typography } from '@abbottland/fui-components';
import type { QbittorrentStats as Stats } from '../lib/homelab-api';
import { formatEta, formatSpeed } from '../lib/display';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';
import { Row, Section } from './Section';

interface QbittorrentStatsProps {
  stats: Stats | null;
}

export function QbittorrentStats({ stats }: QbittorrentStatsProps) {
  return (
    <Section
      title="qBittorrent Stats"
      available={stats !== null}
      after={
        <>
          {stats && stats.torrents.length === 0 && (
            <Typography variant="body2" className="text-neutral-400">
              Nothing is transferring.
            </Typography>
          )}
          {stats?.torrents.map((torrent) => {
            const percent = Math.round(torrent.progress * 100);
            return (
              <div key={torrent.name} className="flex flex-col gap-1">
                <Typography variant="body2" className="break-all">
                  {torrent.name}
                </Typography>
                <div
                  role="progressbar"
                  aria-label={`${torrent.name} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  className="h-2 w-full bg-neutral-700"
                >
                  <div
                    className="h-full bg-primary-600"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <Typography variant="small" className="text-neutral-400">
                  {percent}% of {formatBytes(torrent.sizeBytes)} ·{' '}
                  {formatSpeed(torrent.downloadSpeed)} down · ETA{' '}
                  {formatEta(torrent.etaSeconds)}
                </Typography>
              </div>
            );
          })}
        </>
      }
    >
      <Row label="Download speed">
        {stats ? formatSpeed(stats.downloadSpeed) : '—'}
      </Row>
      <Row label="Upload speed">
        {stats ? formatSpeed(stats.uploadSpeed) : '—'}
      </Row>
      <Row label="Active torrents">{stats?.activeCount ?? '—'}</Row>
    </Section>
  );
}
