export type DotGridBackgroundColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'accent-purple'
  | 'accent-falcon';

export type DotGridBackgroundProps = {
  color: DotGridBackgroundColor;
  active?: boolean;
};

const getDotColorClass = (
  color: DotGridBackgroundColor,
  active?: boolean,
): string => {
  const defaultColors = {
    default: 'text-neutral-600',
    primary: 'text-primary-800',
    secondary: 'text-secondary-800',
    success: 'text-success-700',
    error: 'text-error-800',
    warning: 'text-warning-800',
    'accent-purple': 'text-accent-purple-700',
    'accent-falcon': 'text-accent-falcon-700',
  };
  const activeColors = {
    default: 'text-neutral-50',
    primary: 'text-primary-500',
    secondary: 'text-secondary-500',
    success: 'text-success-500',
    error: 'text-error-500',
    warning: 'text-warning-500',
    'accent-purple': 'text-accent-purple-500',
    'accent-falcon': 'text-accent-falcon-400',
  };

  return active ? activeColors[color] : defaultColors[color];
};

export const DotGridBackground = ({
  color,
  active = false,
}: DotGridBackgroundProps) => {
  const dotSize = 1;
  const spacing = 17;
  const colorClass = getDotColorClass(color, active);
  const blackPercent = active ? '10%' : '40%';

  return (
    <div
      className={`absolute inset-0 ${colorClass} transition-all duration-300 cursor-pointer`}
      style={{
        backgroundImage: `radial-gradient(currentColor ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
        //maskImage: `radial-gradient(circle at center, black 0%, black ${blackPercent}, transparent 80%)`,
        WebkitMaskImage: `radial-gradient(circle at center, black 0%, black ${blackPercent}, transparent 70%)`,
      }}
    />
  );
};
