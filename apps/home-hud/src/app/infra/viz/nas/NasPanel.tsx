'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OutlinedButton, Panel, Typography } from '@abbottland/fui-components';
import { AppearancePanel } from '../components/AppearancePanel';
import { isCameraAngle, type CameraAngle } from '../components/camera-angles';
import type { ModelViewerHandle } from '../components/ModelViewer';
import {
  OFFLINE_ACCENT_COLOR,
  UNKNOWN_ACCENT_COLOR,
  type ModelStatus,
} from '../components/resolve-material-colors';
import { ASUSTOR_NAS_CONFIG } from '../models/nas/config';
import { MOCK_NAS_BAYS } from '../models/nas/mock-bays';
import { BAY_STATUS_COLOR } from '../models/nas/status-colors';

const DEFAULT_EDGE_COLOR = ASUSTOR_NAS_CONFIG.materials.edgeHighlight;

const NasScene = dynamic(() => import('./NasScene'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950" aria-hidden />,
});

/**
 * The NAS viewer's inner content — Scene panel + drive-bay side panel.
 * Fully self-contained (own `?angle=`/`?ref=` parsing, own selection
 * state, own `viewerRef`). Rendered inside a `<TabsContent>` by
 * `../VizViewerClient.tsx`, which owns the shared `<main>`/H1/tab row.
 */
export function NasPanel() {
  const searchParams = useSearchParams();
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null);
  const [edgeColor, setEdgeColor] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ModelStatus>('online');
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
    () => MOCK_NAS_BAYS.find((bay) => bay.id === selectedBayId) ?? null,
    [selectedBayId],
  );

  function handleSelectBay(bayId: string) {
    setSelectedBayId((current) => (current === bayId ? null : bayId));
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Panel color="default" className="relative h-[70vh] flex-1">
        <NasScene
          deviceName="Room of Requirement (mock)"
          bays={MOCK_NAS_BAYS}
          selectedBayId={selectedBayId}
          hoveredBayId={hoveredBayId}
          onSelectBay={handleSelectBay}
          onHoverBay={setHoveredBayId}
          initialAngle={initialAngle}
          viewerRef={viewerRef}
          edgeColor={edgeColor}
          status={status}
        />
        {referenceImageSrc && (
          <img
            src={referenceImageSrc}
            alt={`${referenceAngle} reference`}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-40"
          />
        )}
      </Panel>

      <div className="flex w-full flex-col gap-4 lg:w-80">
        <AppearancePanel
          edgeColor={edgeColor}
          onEdgeColorChange={setEdgeColor}
          defaultColor={DEFAULT_EDGE_COLOR}
          status={status}
          onStatusChange={setStatus}
        />

        <Panel color="default" className="flex w-full flex-col gap-4">
          <Typography variant="h5" component="h2">
            Drive bays
          </Typography>
          <Typography variant="body2" className="text-neutral-400">
            Mock status data — click a bay in the model.
          </Typography>

          <div className="flex flex-col gap-2">
            {MOCK_NAS_BAYS.map((bay) => (
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
                    style={{
                      backgroundColor:
                        status === 'offline'
                          ? OFFLINE_ACCENT_COLOR
                          : status === 'unknown'
                            ? UNKNOWN_ACCENT_COLOR
                            : BAY_STATUS_COLOR[bay.status],
                    }}
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
    </div>
  );
}
