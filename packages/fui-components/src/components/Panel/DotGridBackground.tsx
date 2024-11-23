import { PanelColor } from "./types";
// https://claude.ai/chat/615031e5-1910-4312-9c30-fa918b725ef2

const getDotColorClass = (color: PanelColor) => {
  const colors = {
    default: "fill-neutral-500",
    white: "fill-neutral-50",
    primary: "fill-primary-300",
    secondary: "fill-secondary-200",
    success: "fill-success-100",
    error: "fill-error-200",
    warning: "fill-warning-100",
    "accent-purple": "fill-accent-purple-100",
    "accent-falcon": "fill-accent-falcon-200",
  };
  return colors[color] || "";
};

const DotGridBackground = ({ color }: { color: PanelColor }) => {
  // These values can be adjusted to match your desired appearance
  const dotSize = 0.4;
  const spacing = 10;
  const dotColorClassName = getDotColorClass(color);
  const patternId = `dot-pattern-${color}`;

  return (
    <div className="absolute inset-0 -z-10">
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 100 100`}
      >
        <pattern
          id={patternId}
          x="0"
          y="0"
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={spacing / 2}
            cy={spacing / 2}
            r={dotSize}
            className={dotColorClassName}
          />
        </pattern>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
};

export default DotGridBackground;
