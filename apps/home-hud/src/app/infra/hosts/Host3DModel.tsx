'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { ModelStatus } from '../viz/components/resolve-material-colors';
import { MOCK_NAS_BAYS } from '../viz/models/nas/mock-bays';

const NasScene = dynamic(() => import('../viz/nas/NasScene'), {
  ssr: false,
  loading: () => (
    <div className="h-[32rem] w-full bg-neutral-950" aria-hidden />
  ),
});

const Pironman4Scene = dynamic(
  () => import('../viz/pironman4/Pironman4Scene'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[32rem] w-full bg-neutral-950" aria-hidden />
    ),
  },
);

const BeelinkSer5Scene = dynamic(
  () => import('../viz/beelink-ser5/BeelinkSer5Scene'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[32rem] w-full bg-neutral-950" aria-hidden />
    ),
  },
);

interface Host3DModelProps {
  modelSlug: string;
  hostName: string;
  /** Mirrors the host's real `HostStatus` — grays/recolors the model to match its 2D status badge instead of always rendering "online". Defaults to `'online'` for any caller that doesn't have a status yet. */
  status?: ModelStatus;
}

/**
 * Renders the procedural 3D model matching a host's `model3d` slug, in
 * place of the generic "No image yet" placeholder. One case per model in
 * ../viz/models/registry.ts — add a case here (and a registry entry) when
 * a new model becomes host-attachable.
 */
export function Host3DModel({
  modelSlug,
  hostName,
  status = 'online',
}: Host3DModelProps) {
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null);

  if (modelSlug === 'nas') {
    return (
      <div className="h-[32rem] w-full border border-neutral-700">
        <NasScene
          deviceName={hostName}
          bays={MOCK_NAS_BAYS}
          selectedBayId={selectedBayId}
          hoveredBayId={hoveredBayId}
          onSelectBay={(bayId) =>
            setSelectedBayId((current) => (current === bayId ? null : bayId))
          }
          onHoverBay={setHoveredBayId}
          status={status}
        />
      </div>
    );
  }

  if (modelSlug === 'pironman4') {
    return (
      <div className="h-[32rem] w-full border border-neutral-700">
        <Pironman4Scene deviceName={hostName} status={status} />
      </div>
    );
  }

  if (modelSlug === 'beelink-ser5') {
    return (
      <div className="h-[32rem] w-full border border-neutral-700">
        <BeelinkSer5Scene deviceName={hostName} status={status} />
      </div>
    );
  }

  return null;
}
