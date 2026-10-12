import { Typography } from '@abbottland/fui-components';
import { TitleCardTile } from './TitleCardTile';
import type { TitleCard } from './lib/video-api';

export type DupGroupBorderColor =
  | 'primary'
  | 'secondary'
  | 'accent-purple'
  | 'accent-falcon';

// Mirrors the border colors fui-components' Panel/OutlinedButton use for
// these same color names, so the dup-group outline reads as the same brand
// color no matter which one is picked here.
const DUP_BORDER_CLASSES: Record<DupGroupBorderColor, string> = {
  primary: 'border-primary-500',
  secondary: 'border-secondary-500',
  'accent-purple': 'border-accent-purple-300',
  'accent-falcon': 'border-accent-falcon-400',
};

interface TitleCardMosaicProps {
  groups: TitleCard[][];
  dupBorderColor?: DupGroupBorderColor;
}

export function TitleCardMosaic({
  groups,
  dupBorderColor = 'primary',
}: TitleCardMosaicProps) {
  return (
    <div className="flex flex-wrap gap-px">
      {groups.map((group) =>
        group.length === 1 ? (
          <TitleCardTile key={group[0].id} titleCard={group[0]} />
        ) : (
          <div
            key={group[0].filePath}
            className={`relative flex border ${DUP_BORDER_CLASSES[dupBorderColor]}`}
          >
            <Typography
              variant="small"
              className="absolute left-1 top-1 z-10 bg-neutral-900/80 px-1 text-neutral-300"
            >
              ×{group.length} dup
            </Typography>
            {group.map((titleCard) => (
              <TitleCardTile key={titleCard.id} titleCard={titleCard} />
            ))}
          </div>
        ),
      )}
    </div>
  );
}
