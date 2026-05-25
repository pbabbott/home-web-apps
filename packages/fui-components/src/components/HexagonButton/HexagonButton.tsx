import { useState } from 'react';
import { KEYFRAMES_STYLES } from './constants';
import { useHexagonButtonStyles } from './useHexagonButtonStyles';
import { HexagonButtonDefs } from './HexagonButtonDefs';
import { HexagonButtonLayers } from './HexagonButtonLayers';
import { HexagonButtonLabels } from './HexagonButtonLabels';

export interface HexagonButtonProps {
  label?: string;
  lowerLabel?: string;
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function HexagonButton({
  label = '',
  lowerLabel = '',
  active = false,
  onClick,
}: HexagonButtonProps) {
  const [hovered, setHovered] = useState(false);
  const styles = useHexagonButtonStyles(active, hovered);

  return (
    <>
      <style>{KEYFRAMES_STYLES}</style>
      <button
        style={{
          position: 'relative',
          width: 120,
          height: 120,
          cursor: 'pointer',
          outline: 'none',
          background: 'transparent',
          border: 'none',
          padding: 0,
          WebkitTapHighlightColor: 'transparent',
        }}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        aria-pressed={active}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          style={{
            overflow: 'visible',
            transition: 'filter 0.4s ease',
            filter: styles.svgFilter,
          }}
        >
          <HexagonButtonDefs />
          <HexagonButtonLayers {...styles} />
          <HexagonButtonLabels
            label={label}
            lowerLabel={lowerLabel}
            hovered={hovered}
          />
        </svg>
      </button>
    </>
  );
}
