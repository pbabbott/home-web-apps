'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { MOCK_NAS_BAYS } from '../viz/models/nas/mock-bays';

const NasScene = dynamic(() => import('../viz/nas/NasScene'), {
  ssr: false,
  loading: () => <div className="h-56 w-full bg-neutral-950" aria-hidden />,
});

interface Host3DModelProps {
  modelSlug: string;
  hostName: string;
}

/**
 * Renders the procedural 3D model matching a host's `model3d` slug, in
 * place of the generic "No image yet" placeholder. One case per model in
 * ../viz/models/registry.ts — add a case here (and a registry entry) when
 * a new model becomes host-attachable.
 */
export function Host3DModel({ modelSlug, hostName }: Host3DModelProps) {
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null);

  if (modelSlug === 'nas') {
    return (
      <div className="h-56 w-full border border-neutral-700">
        <NasScene
          deviceName={hostName}
          health="healthy"
          bays={MOCK_NAS_BAYS}
          selectedBayId={selectedBayId}
          hoveredBayId={hoveredBayId}
          onSelectBay={(bayId) =>
            setSelectedBayId((current) => (current === bayId ? null : bayId))
          }
          onHoverBay={setHoveredBayId}
        />
      </div>
    );
  }

  return null;
}
