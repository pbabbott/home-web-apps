import React from 'react';
import { PanelColor } from './types';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const Cross = ({
  position,
  lineClasses,
}: {
  position: Position;
  lineClasses: string;
}) => {
  const crossSize = 14;
  const halfSize = crossSize / 2;
  const crossWidth = 2;
  const relativePosition = -halfSize - 1;

  return (
    <svg
      className="absolute"
      width={crossSize}
      height={crossSize}
      viewBox={`0 0 ${crossSize} ${crossSize}`}
      style={{
        top: position.includes('top') ? relativePosition : 'auto',
        bottom: position.includes('bottom') ? relativePosition : 'auto',
        left: position.includes('left') ? relativePosition : 'auto',
        right: position.includes('right') ? relativePosition : 'auto',
      }}
    >
      <line
        x1="0"
        y1={halfSize}
        x2={crossSize}
        y2={halfSize}
        strokeWidth={crossWidth}
        className={lineClasses}
        shapeRendering="crispEdges"
      />
      <line
        x1={halfSize}
        y1="0"
        x2={halfSize}
        y2={crossSize}
        strokeWidth={crossWidth}
        className={lineClasses}
        shapeRendering="crispEdges"
      />
    </svg>
  );
};

const getStrokeColorClass = (color: PanelColor) => {
  const colors = {
    default: 'stroke-neutral-600',
    white: 'stroke-neutral-50',
    primary: 'stroke-primary-500',
    secondary: 'stroke-secondary-500',
    success: 'stroke-success-400',
    error: 'stroke-error-400',
    warning: 'stroke-warning-400',
    'accent-purple': 'stroke-accent-purple-300',
    'accent-falcon': 'stroke-accent-falcon-400',
  };
  return colors[color] || '';
};

export interface CornerSquaresProps {
  color: PanelColor;
}

const CornerCrosses: React.FC<CornerSquaresProps> = ({ color }) => {
  const lineClasses = getStrokeColorClass(color);
  return (
    <>
      <Cross position="top-left" lineClasses={lineClasses} />
      <Cross position="top-right" lineClasses={lineClasses} />
      <Cross position="bottom-left" lineClasses={lineClasses} />
      <Cross position="bottom-right" lineClasses={lineClasses} />
    </>
  );
};

export default CornerCrosses;
