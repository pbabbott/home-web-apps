import { useMemo } from 'react';
import { PIRONMAN4_CONFIG, type Pironman4Config } from './config';
import { usePironman4Materials } from './materials';
import { Chassis } from './parts/Chassis';
import { FanGrille } from './parts/FanGrille';
import { FrontPanel } from './parts/FrontPanel';
import { PortsPanel } from './parts/PortsPanel';
import type { Pironman4ModelProps } from './types';

interface Pironman4Props extends Pironman4ModelProps {
  config?: Pironman4Config;
}

/**
 * Assembles the procedural Pironman4 case from its part components. No
 * feet — unlike the NAS, the real case sits flush on its aluminum base
 * (see REFERENCES.md). The rear (-Z) face is laid out from a real
 * close-up reference (`photos/back-ports.jpg`) — see REFERENCES.md for
 * the photo-to-face orientation mapping.
 */
export function Pironman4({
  config = PIRONMAN4_CONFIG,
  edgeColor,
}: Pironman4Props) {
  const materialColors = useMemo(
    () =>
      edgeColor
        ? { ...config.materials, edgeHighlight: edgeColor }
        : config.materials,
    [config.materials, edgeColor],
  );
  const materials = usePironman4Materials(materialColors);

  return (
    <group>
      <Chassis config={config} materials={materials} />
      <FrontPanel config={config} materials={materials} />
      <FanGrille config={config} materials={materials} />
      <PortsPanel config={config} materials={materials} />
    </group>
  );
}
