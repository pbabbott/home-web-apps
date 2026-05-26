'use client';

import { Typography } from '@abbottland/fui-components';

interface NodePreviewProps {
  type: string;
  label: string;
}

export function NodePreview({ type, label }: NodePreviewProps) {
  if (type === 'text') {
    return (
      <div className="flex items-center justify-center px-2 py-3">
        <Typography
          variant="body1"
          component="span"
          className="text-neutral-200 whitespace-pre-wrap"
        >
          {label}
        </Typography>
      </div>
    );
  }

  const showLabel = type === 'labeled';

  return (
    <div
      className="relative bg-neutral-800 border-2 border-neutral-600 flex items-center justify-center"
      style={{ width: 150, height: 80 }}
    >
      {!showLabel && (
        <Typography
          variant="body2"
          component="span"
          className="text-neutral-400"
        >
          Default Node
        </Typography>
      )}
      {showLabel && (
        <div className="absolute -top-3 left-2 px-2 py-0.5 bg-neutral-700 border-2 border-neutral-600 text-xs font-medium z-10">
          <Typography
            variant="body2"
            component="span"
            className="text-neutral-200"
          >
            {label}
          </Typography>
        </div>
      )}
    </div>
  );
}
