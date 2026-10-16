import { useMemo } from 'react';
import { resolveMaterialColors } from '../../components/resolve-material-colors';
import {
  ASUSTOR_NAS_CONFIG,
  computeBayPositionsX,
  computeBayRowY,
  computeBayWidth,
  type NasConfig,
} from './config';
import { useNasMaterials } from './materials';
import { Chassis } from './parts/Chassis';
import { DriveBay } from './parts/DriveBay';
import { Feet } from './parts/Feet';
import { FrontFascia } from './parts/FrontFascia';
import { HeaderPanel } from './parts/HeaderPanel';
import { RearPanel } from './parts/RearPanel';
import { SidePanelVent } from './parts/SidePanelVent';
import { TopVent } from './parts/TopVent';
import type { NasModelProps } from './types';

interface AsustorNasProps extends NasModelProps {
  config?: NasConfig;
}

/**
 * Assembles the procedural ASUSTOR NAS from its part components. This is
 * the only place that reads config.bays.count and lays bays out — adding a
 * bay means changing ASUSTOR_NAS_CONFIG, not this component.
 */
export function AsustorNas({
  config = ASUSTOR_NAS_CONFIG,
  bays,
  selectedBayId,
  hoveredBayId,
  onSelectBay,
  onHoverBay,
  edgeColor,
  status = 'online',
}: AsustorNasProps) {
  const materialColors = useMemo(
    () => resolveMaterialColors(config.materials, { edgeColor, status }),
    [config.materials, edgeColor, status],
  );
  const materials = useNasMaterials(materialColors);
  const bayPositionsX = computeBayPositionsX(config);
  const bayRowY = computeBayRowY(config);
  const bayWidth = computeBayWidth(config);

  return (
    <group>
      <Chassis config={config} materials={materials} />
      <FrontFascia config={config} materials={materials} />
      <HeaderPanel config={config} materials={materials} />
      <TopVent config={config} materials={materials} />
      <SidePanelVent config={config} materials={materials} />
      <RearPanel config={config} materials={materials} />
      <Feet config={config} materials={materials} />
      {bays.slice(0, config.bays.count).map((bay, i) => (
        <DriveBay
          key={bay.id}
          config={config}
          materials={materials}
          bay={bay}
          bayWidth={bayWidth}
          positionX={bayPositionsX[i]}
          positionY={bayRowY}
          isSelected={bay.id === selectedBayId}
          isHovered={bay.id === hoveredBayId}
          onSelect={onSelectBay}
          onHover={onHoverBay}
        />
      ))}
    </group>
  );
}
