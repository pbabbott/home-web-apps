'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  OutlinedButton,
  Panel,
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
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [seriesMenuOpen, setSeriesMenuOpen] = useState(false);

  const selectedSeriesRow = series.find((s) => s.seriesName === selectedSeries);
  const lastSeason = selectedSeriesRow?.seasonCount ?? DEFAULT_LAST_SEASON;
  const seasonOptions = Array.from(
    { length: Math.max(1, lastSeason - FIRST_SEASON + 1) },
    (_, i) => FIRST_SEASON + i,
  );

  // Both filters live in the URL together — build it from URLSearchParams
  // rather than a hardcoded single-param string, so changing one filter
  // never drops the other.
  function buildFilterUrl(
    season: number | null,
    seriesName: string | null,
  ): string {
    const params = new URLSearchParams();
    if (season !== null) params.set('season', String(season));
    if (seriesName !== null) params.set('series', seriesName);

    const query = params.toString();
    return query ? `/video/title-cards?${query}` : '/video/title-cards';
  }

  function selectSeason(season: number | null) {
    router.push(buildFilterUrl(season, selectedSeries));
  }

  function selectSeries(seriesName: string | null) {
    router.push(buildFilterUrl(selectedSeason, seriesName));
  }

  const ready = selectedSeries !== null && selectedSeason !== null;

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Title Cards
      </Typography>

      <div className="flex items-center gap-3 self-start">
        <DropdownMenu open={seriesMenuOpen} onOpenChange={setSeriesMenuOpen}>
          <DropdownMenuTrigger asChild>
            <OutlinedButton size="small">
              Series: {selectedSeries ?? 'All'}
            </OutlinedButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Filter by Series">
            <DropdownMenuItem onSelect={() => selectSeries(null)}>
              All Series
            </DropdownMenuItem>
            {series.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => selectSeries(s.seriesName)}
              >
                {s.seriesName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={seasonMenuOpen} onOpenChange={setSeasonMenuOpen}>
          <DropdownMenuTrigger asChild>
            <OutlinedButton size="small">
              Season: {selectedSeason ?? 'All'}
            </OutlinedButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Filter by Season">
            <DropdownMenuItem onSelect={() => selectSeason(null)}>
              All Seasons
            </DropdownMenuItem>
            {seasonOptions.map((season) => (
              <DropdownMenuItem
                key={season}
                onSelect={() => selectSeason(season)}
              >
                Season {season}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
