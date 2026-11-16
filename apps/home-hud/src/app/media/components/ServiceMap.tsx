'use client';

import { TiledHexagons, Typography } from '@abbottland/fui-components';
import { PanZoomCanvas } from '../../infra/cluster-map/PanZoomCanvas';
import type { PodMapItem } from '../../infra/cluster-map/lib/homelab-api';
import {
  MAX_HORIZONTAL_GROUPED,
  itemToTile,
} from '../../infra/cluster-map/lib/pod-tiles';

interface ServiceMapProps {
  /** The `media` namespace's pods; null when the cluster map could not be loaded. */
  items: PodMapItem[] | null;
}

const noop = () => {};

/** A small, filtered /infra/cluster-map: one hex per media workload, colored by CPU/memory, with the same pan and zoom. */
export function ServiceMap({ items }: ServiceMapProps) {
  if (items === null || items.length === 0) {
    return (
      <Typography variant="body2" className="text-neutral-400">
        {items === null ? 'Unavailable.' : 'No media pods found.'}
      </Typography>
    );
  }

  return (
    <div className="flex h-96 flex-col">
      <PanZoomCanvas resetKey="media">
        <div className="p-4">
          <TiledHexagons
            maxHorizontal={MAX_HORIZONTAL_GROUPED}
            tiles={items.map((item) => itemToTile(item, 'both', null, noop))}
          />
        </div>
      </PanZoomCanvas>
    </div>
  );
}
