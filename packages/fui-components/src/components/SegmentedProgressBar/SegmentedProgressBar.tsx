'use client';

import { primary, neutral } from '../../tokens/colors';
import Typography from '../Typography/Typography';

export type SegmentedProgressBarProps = {
  totalSegments: number;
  currentIndex: number;
  showLabel?: boolean;
  labelText?: string;
  showIndex?: boolean;
};

type SegmentState = 'completed' | 'current' | 'future';

function getSegmentState(i: number, currentIndex: number): SegmentState {
  if (i + 1 < currentIndex) return 'completed';
  if (i + 1 === currentIndex) return 'current';
  return 'future';
}

const shimmerKeyframes = `
@keyframes fui-segment-shimmer {
  0%   { opacity: 0.55; }
  50%  { opacity: 0.85; }
  100% { opacity: 0.55; }
}
`;

const segmentStyles: Record<SegmentState, React.CSSProperties> = {
  completed: {
    backgroundColor: `${primary[500]}A8`,
    boxShadow: `0 0 4px 0px ${primary[500]}40`,
  },
  current: {
    backgroundColor: primary[500],
    boxShadow: `0 0 6px 1px ${primary[500]}80`,
    animation: 'fui-segment-shimmer 3s ease-in-out infinite',
  },
  future: {
    backgroundColor: neutral[700],
    opacity: 0.45,
  },
};

export function SegmentedProgressBar({
  totalSegments,
  currentIndex,
  showLabel = false,
  labelText = 'Series Article',
  showIndex = false,
}: SegmentedProgressBarProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <style>{shimmerKeyframes}</style>
      {showLabel && (
        <Typography
          variant="small"
          className="text-neutral-500 uppercase tracking-widest"
        >
          {labelText}
        </Typography>
      )}
      <div className="flex flex-row gap-1 w-full">
        {Array.from({ length: totalSegments }, (_, i) => {
          const state = getSegmentState(i, currentIndex);
          return (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-sm"
              style={segmentStyles[state]}
            />
          );
        })}
      </div>
      {showIndex && (
        <Typography variant="small" className="text-neutral-500 text-right">
          {currentIndex} of {totalSegments}
        </Typography>
      )}
    </div>
  );
}
