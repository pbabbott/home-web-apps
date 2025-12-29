'use client';

import { Typography } from '@abbottland/fui-components';

interface SelectionInfoProps {
  selectedNodeIds: string[];
}

export function SelectionInfo({ selectedNodeIds }: SelectionInfoProps) {
  const hasSelection = selectedNodeIds.length > 0;

  return (
    <div className="border-t border-secondary-700 pt-4">
      <Typography variant="h2" component="h2">
        Props
      </Typography>
      {hasSelection ? (
        <Typography
          variant="body1"
          component="p"
          className="text-neutral-100"
        >
          {selectedNodeIds.length} node{selectedNodeIds.length > 1 ? 's' : ''}{' '}
          selected
        </Typography>
      ) : (
        <Typography
          variant="body1"
          component="p"
          className="text-neutral-500 italic"
        >
          No selection
        </Typography>
      )}
    </div>
  );
}

