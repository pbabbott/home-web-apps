'use client';

import { Typography } from '@abbottland/fui-components';

export function TipsSection() {
  return (
    <div className="mt-auto border-t border-secondary-700 pt-4 text-xs text-secondary-500">
      <Typography
        variant="body1"
        component="p"
        className="text-secondary-400"
      >
        Tips:
      </Typography>
      <ul className="list-disc list-inside mt-1 space-y-1">
        <li>
          <Typography variant="body1" component="span">
            Drag from handle to handle to connect
          </Typography>
        </li>
        <li>
          <Typography variant="body1" component="span">
            Click a node to select it
          </Typography>
        </li>
        <li>
          <Typography variant="body1" component="span">
            Drag corners to resize
          </Typography>
        </li>
        <li>
          <Typography variant="body1" component="span">
            Double-click to edit text
          </Typography>
        </li>
        <li>
          <Typography variant="body1" component="span">
            Press Delete to remove selected
          </Typography>
        </li>
      </ul>
    </div>
  );
}

