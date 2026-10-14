'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OutlinedButton, Panel, Typography } from '@abbottland/fui-components';
import { isCameraAngle, type CameraAngle } from '../components/camera-angles';
import type { ModelViewerHandle } from '../components/ModelViewer';
import { BAY_STATUS_COLOR } from '../models/nas/status-colors';
import type { BayState } from '../models/nas/types';

const NasScene = dynamic(() => import('./NasScene'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950" aria-hidden />,
});

/**
 * Mock drive-bay data for this dev viewer — not real NAS telemetry. Once
 * this viewer is wired into a real data source, a caller supplies `bays`
 * instead of this constant (see models/nas/types.ts NasModelProps).
 */
const MOCK_BAYS: BayState[] = [
  { id: 'bay-1', label: 'Bay 1', status: 'active', capacityRatio: 0.72 },
  { id: 'bay-2', label: 'Bay 2', status: 'active', capacityRatio: 0.68 },
  { id: 'bay-3', label: 'Bay 3', status: 'active', capacityRatio: 0.81 },
  { id: 'bay-4', label: 'Bay 4', status: 'idle', capacityRatio: 0.1 },
  { id: 'bay-5', label: 'Bay 5', status: 'empty' },
  { id: 'bay-6', label: 'Bay 6', status: 'empty' },
];

export function NasViewerClient() {
  const searchParams = useSearchParams();
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null);
  const viewerRef = useRef<ModelViewerHandle>(null);

  const angleParam = searchParams.get('angle');
  const initialAngle: CameraAngle | undefined =
    angleParam && isCameraAngle(angleParam) ? angleParam : undefined;

  const refParam = searchParams.get('ref');
  const referenceAngle: CameraAngle | null =
    refParam && isCameraAngle(refParam) ? refParam : null;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const referenceImageSrc = referenceAngle
    ? `${basePath}/nas-asustor/photos/${referenceAngle}.jpg`
    : null;

  const selectedBay = useMemo(
    () => MOCK_BAYS.find((bay) => bay.id === selectedBayId) ?? null,
    [selectedBayId],
  );

  function handleSelectBay(bayId: string) {
    setSelectedBayId((current) => (current === bayId ? null : bayId));
  }

  return (
    <main className="flex flex-col gap-4 p-6">
      <Typography variant="h1">NAS 3D Viewer</Typography>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Panel color="default" className="relative h-[70vh] flex-1">
          <NasScene
            deviceName="Room of Requirement (mock)"
            health="healthy"
            bays={MOCK_BAYS}
            selectedBayId={selectedBayId}
            hoveredBayId={hoveredBayId}
            onSelectBay={handleSelectBay}
            onHoverBay={setHoveredBayId}
            initialAngle={initialAngle}
            viewerRef={viewerRef}
          />
          {referenceImageSrc && (
            <img
              src={referenceImageSrc}
              alt={`${referenceAngle} reference`}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-40"
            />
          )}
        </Panel>

        <Panel color="default" className="flex w-full flex-col gap-4 lg:w-80">
          <Typography variant="h5" component="h2">
            Drive bays
          </Typography>
          <Typography variant="body2" className="text-neutral-400">
            Mock status data — click a bay in the model.
          </Typography>

          <div className="flex flex-col gap-2">
            {MOCK_BAYS.map((bay) => (
              <OutlinedButton
                key={bay.id}
                size="small"
                onClick={() => handleSelectBay(bay.id)}
                className={bay.id === selectedBayId ? 'border-primary-500' : ''}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Typography variant="body2">{bay.label}</Typography>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: BAY_STATUS_COLOR[bay.status] }}
                  />
                </span>
              </OutlinedButton>
            ))}
          </div>

          {selectedBay ? (
            <div className="flex flex-col gap-1 border-t border-neutral-700 pt-3">
              <Typography variant="body2">{selectedBay.label}</Typography>
              <Typography variant="caption" className="text-neutral-400">
                Status: {selectedBay.status}
              </Typography>
              {selectedBay.capacityRatio !== undefined && (
                <Typography variant="caption" className="text-neutral-400">
                  Capacity: {Math.round(selectedBay.capacityRatio * 100)}%
                </Typography>
              )}
            </div>
          ) : (
            <Typography variant="caption" className="text-neutral-500">
              No bay selected.
            </Typography>
          )}
        </Panel>
      </div>
    </main>
  );
}
