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
  /** false = suppress shimmer sweep and travel-ring spark effects (e.g. reduced-motion mode). Selected styling (color/border/glow) is unaffected. */
  animated?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function HexagonButton({
  label = '',
  lowerLabel = '',
  active = false,
  animated = true,
  onClick,
}: HexagonButtonProps) {
  const [hovered, setHovered] = useState(false);
  const styles = useHexagonButtonStyles(active, hovered, animated);

  return (
    <>
      <style>{KEYFRAMES_STYLES}</style>
      <button
        style={{
          position: 'relative',
          width: 100,
          height: 100,
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
          width="100"
          height="100"
          viewBox="0 0 100 100"
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
