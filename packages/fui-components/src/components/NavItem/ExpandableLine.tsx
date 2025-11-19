export type ExpandableLineProps = {
  stroke?: string;
  strokeWidth?: number;
  className?: string;
};

export const ExpandableLine = ({
  stroke = 'currentColor',
  strokeWidth = 2,
  className = '',
}: ExpandableLineProps) => {
  const startingWidth = 10;
  return (
    <svg
      className={className}
      width="100%"
      height={strokeWidth}
      viewBox={`0 0 ${startingWidth} ${strokeWidth}`}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1={strokeWidth / 2}
        x2={startingWidth}
        y2={strokeWidth / 2}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

