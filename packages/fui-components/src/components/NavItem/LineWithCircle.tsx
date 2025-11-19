export type LineWithCircleProps = {
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  circleRadius?: number;
  className?: string;
};

export const LineWithCircle = ({
  height = 15,
  stroke = 'currentColor',
  strokeWidth = 1,
  circleRadius = 2.5,
  className = '',
}: LineWithCircleProps) => {
  const circleY = circleRadius + strokeWidth;

  return (
    <svg
      width="1"
      height={height}
      className={className}
      viewBox={`0 0 1 ${height}`}
      preserveAspectRatio="xMidYMin meet"
      overflow="visible"
    >
      {/* Vertical line */}
      <line
        x1="0.5"
        y1={circleY}
        x2="0.5"
        y2={height}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      {/* Circle at the top */}
      <circle cx="0.5" cy={circleY} r={circleRadius} fill="currentColor" />
    </svg>
  );
};

