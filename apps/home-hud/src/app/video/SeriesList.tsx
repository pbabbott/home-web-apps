import { TransparentPanel, Typography } from '@abbottland/fui-components';
import type { Series } from './series/lib/video-api';

interface SeriesListProps {
  series: Series[];
}

/** Read-only list of every series the video pipeline knows about — no CRUD yet, just visibility into the series -> directory mapping. */
export function SeriesList({ series }: SeriesListProps) {
  return (
    <TransparentPanel color="dark" className="flex flex-col gap-3">
      <Typography variant="h6" component="h2" className="text-neutral-400">
        Series
      </Typography>

      {series.length === 0 ? (
        <Typography variant="body2" className="text-neutral-300">
          No series configured yet.
        </Typography>
      ) : (
        <ul className="flex flex-col gap-1">
          {series.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <Typography variant="body2">{s.seriesName}</Typography>
              <Typography variant="caption" className="text-neutral-300">
                {s.directoryName} · {s.seasonCount} season
                {s.seasonCount === 1 ? '' : 's'}
              </Typography>
            </li>
          ))}
        </ul>
      )}
    </TransparentPanel>
  );
}
