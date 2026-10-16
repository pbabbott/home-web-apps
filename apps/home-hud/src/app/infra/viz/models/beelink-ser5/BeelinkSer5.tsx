import { useMemo } from 'react';
import { resolveMaterialColors } from '../../components/resolve-material-colors';
import { BEELINK_SER5_CONFIG, type BeelinkSer5Config } from './config';
import { useBeelinkSer5Materials } from './materials';
import { Chassis } from './parts/Chassis';
import { FrontPanel } from './parts/FrontPanel';
import { RearPanel } from './parts/RearPanel';
import { SideVents } from './parts/SideVents';
import { TopVent } from './parts/TopVent';
import type { BeelinkSer5ModelProps } from './types';

interface BeelinkSer5Props extends BeelinkSer5ModelProps {
  config?: BeelinkSer5Config;
}

/**
 * Assembles the procedural Beelink SER5 mini PC from its part components.
 * A low, wide box — much wider/deeper than tall — unlike the Pironman4's
 * tower. Front I/O is laid out from a real dead-on photo; top/side vents
 * and the rear I/O are reconstructed from a single 3/4 marketing shot —
 * see REFERENCES.md.
 */
export function BeelinkSer5({
  config = BEELINK_SER5_CONFIG,
  edgeColor,
  status = 'online',
}: BeelinkSer5Props) {
  const materialColors = useMemo(
    () => resolveMaterialColors(config.materials, { edgeColor, status }),
    [config.materials, edgeColor, status],
  );
  const materials = useBeelinkSer5Materials(materialColors);

  return (
    <group>
      <Chassis config={config} materials={materials} />
      <TopVent config={config} materials={materials} />
      <SideVents config={config} materials={materials} />
      <FrontPanel config={config} materials={materials} />
      <RearPanel config={config} materials={materials} />
    </group>
  );
}
