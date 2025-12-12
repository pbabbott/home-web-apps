import { useState } from 'react';
import { DotGridBackground } from '../DotGridBackground/DotGridBackground';
import type { DotGridBackgroundColor } from '../DotGridBackground/DotGridBackground';

export type CardProps = {
  children: React.ReactNode;
  color?: CardColor;
  size?: CardSize;
};

export type CardColor = DotGridBackgroundColor;
export type CardSize = 'default' | 'large';

const getCardColorClasses = (color: CardColor): string => {
  const colorMap = {
    default:
      'border-neutral-500 border-l-neutral-900 hover:border-l-neutral-500',
    primary:
      'border-primary-500 border-l-primary-800 hover:border-l-primary-500',
    secondary:
      'border-secondary-500 border-l-secondary-800 hover:border-l-secondary-500',
    success:
      'border-success-500 border-l-success-700 hover:border-l-success-500',
    error: 'border-error-500 border-l-error-800 hover:border-l-error-500',
    warning:
      'border-warning-500 border-l-warning-800 hover:border-l-warning-500',
    'accent-purple':
      'border-accent-purple-500 border-l-accent-purple-700 hover:border-l-accent-purple-500',
    'accent-falcon':
      'border-accent-falcon-500 border-l-accent-falcon-700 hover:border-l-accent-falcon-500',
  };

  return colorMap[color];
};

const getCardSizeClasses = (size: CardSize): string => {
  const sizeMap = {
    default: 'p-4',
    large: 'p-10',
  };

  return sizeMap[size];
};

export const Card = ({
  children,
  color = 'default',
  size = 'default',
}: CardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const colorClasses = getCardColorClasses(color);
  const sizeClasses = getCardSizeClasses(size);

  return (
    <div
      className={`text-neutral-50 border-y border-r border-l-8 rounded-lg relative cursor-pointer transition-all duration-300 group isolate ${colorClasses} ${sizeClasses}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <DotGridBackground color={color} active={isHovered} />
      {children}
    </div>
  );
};
