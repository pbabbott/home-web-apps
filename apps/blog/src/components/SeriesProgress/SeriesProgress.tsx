'use client';

import { Typography, SegmentedProgressBar } from '@abbottland/fui-components';
import type { BlogPostSeries } from '@/types/blog';

type SeriesProgressProps = {
  series: BlogPostSeries;
  showLabel?: boolean;
  labelText?: string;
};

export default function SeriesProgress({
  series,
  showLabel = true,
  labelText = 'Series Article',
}: SeriesProgressProps) {
  if (!series.total) return null;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <Typography
        variant="small"
        className="text-primary-400 font-medium truncate"
      >
        {series.name}
      </Typography>
      <SegmentedProgressBar
        totalSegments={series.total}
        currentIndex={series.index}
        showLabel={showLabel}
        labelText={labelText}
        showIndex={true}
      />
    </div>
  );
}
