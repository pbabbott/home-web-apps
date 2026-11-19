'use client';

import { useRouter } from 'next/navigation';
import {
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Typography,
} from '@abbottland/fui-components';
import { TitleCardMosaic, type DupGroupBorderColor } from './TitleCardMosaic';
import type { TitleCard } from './lib/video-api';
import type { Series } from '../series/lib/video-api';

const FIRST_SEASON = 1;
const DEFAULT_LAST_SEASON = 13;

// Edit to try a different dup-group outline color: 'primary' | 'secondary' |
// 'accent-purple' | 'accent-falcon'.
const DUP_GROUP_BORDER_COLOR: DupGroupBorderColor = 'accent-purple';

interface TitleCardsClientProps {
  titleCards: TitleCard[] | null;
  selectedSeason: number | null;
  selectedSeries: string | null;
  series: Series[];
}

// Cards sharing a filePath are duplicate detections for the same episode —
// grouped together (adjacent, since the input is sorted by filePath first)
// so the mosaic can visually wrap them as one unit.
function groupByFilePath(cards: TitleCard[]): TitleCard[][] {
  const sorted = [...cards].sort((a, b) =>
    a.filePath.localeCompare(b.filePath),
  );
  const groups: TitleCard[][] = [];

  for (const card of sorted) {
    const current = groups[groups.length - 1];
    if (current && current[0].filePath === card.filePath) {
      current.push(card);
    } else {
      groups.push([card]);
    }
  }

  return groups;
}

export function TitleCardsClient({
  titleCards,
  selectedSeason,
  selectedSeries,
  series,
}: TitleCardsClientProps) {
  const router = useRouter();

  const selectedSeriesRow = series.find((s) => s.seriesName === selectedSeries);
  const lastSeason = selectedSeriesRow?.seasonCount ?? DEFAULT_LAST_SEASON;
  const seasonOptions = Array.from(
    { length: Math.max(1, lastSeason - FIRST_SEASON + 1) },
    (_, i) => FIRST_SEASON + i,
  );

  // Both filters live in the URL together — build it from URLSearchParams
  // rather than a hardcoded single-param string, so changing one filter
  // never drops the other.
  function buildFilterUrl(season: number, seriesName: string): string {
    const params = new URLSearchParams({
      season: String(season),
      series: seriesName,
    });
    return `/video/title-cards?${params}`;
  }

  function selectSeason(season: number) {
    if (selectedSeries === null) return;
    router.push(buildFilterUrl(season, selectedSeries));
  }

  function selectSeries(seriesName: string) {
    if (selectedSeason === null) return;
    router.push(buildFilterUrl(selectedSeason, seriesName));
  }

  const ready = selectedSeries !== null && selectedSeason !== null;

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Title Cards
      </Typography>

      <div className="flex items-center gap-3 self-start">
        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-neutral-400">
            Series
          </Typography>
          <Select value={selectedSeries ?? ''} onValueChange={selectSeries}>
            <SelectTrigger
              size="small"
              placeholder="All"
              className="min-w-[160px]"
            />
            <SelectContent label="Filter by Series">
              {selectedSeries !== null && !selectedSeriesRow && (
                // URL names a series that isn't in the list: keep it selectable
                // so the trigger still shows the current value.
                <SelectItem value={selectedSeries}>{selectedSeries}</SelectItem>
              )}
              {series.map((s) => (
                <SelectItem key={s.id} value={s.seriesName}>
                  {s.seriesName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-neutral-400">
            Season
          </Typography>
          <Select
            value={selectedSeason === null ? '' : String(selectedSeason)}
            onValueChange={(value) => selectSeason(Number(value))}
          >
            <SelectTrigger
              size="small"
              placeholder="All"
              className="min-w-[140px]"
            />
            <SelectContent label="Filter by Season">
              {selectedSeason !== null &&
                !seasonOptions.includes(selectedSeason) && (
                  <SelectItem value={String(selectedSeason)}>
                    Season {selectedSeason}
                  </SelectItem>
                )}
              {seasonOptions.map((season) => (
                <SelectItem key={season} value={String(season)}>
                  Season {season}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!ready ? (
        <Panel className="max-w-md">
          <Typography variant="body1">
            Please select a series and season.
          </Typography>
        </Panel>
      ) : titleCards === null ? (
        <Typography variant="body1" className="text-error-400">
          Failed to load title cards from video-api.
        </Typography>
      ) : titleCards.length === 0 ? (
        <Typography variant="body1">
          No title cards for {selectedSeries} Season {selectedSeason}.
        </Typography>
      ) : (
        <TitleCardMosaic
          groups={groupByFilePath(titleCards)}
          dupBorderColor={DUP_GROUP_BORDER_COLOR}
        />
      )}
    </main>
  );
}
