import { useState } from 'react';
import { DotGridBackground } from '../DotGridBackground/DotGridBackground';
import type { DotGridBackgroundColor } from '../DotGridBackground/DotGridBackground';

export type CardProps = {
  children: React.ReactNode;
  color?: CardColor;
  size?: CardSize;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
};

export type CardColor = DotGridBackgroundColor;
export type CardSize = 'default' | 'large';

const getCardColorClasses = (color: CardColor): string => {
  const colorMap = {
    default:
      'border-neutral-500 border-l-neutral-900 hover:border-l-neutral-500',
    primary:
      'border-y-primary-500 border-r-primary-500 border-l-primary-800 hover:border-l-primary-500',
    secondary:
      'border-y-secondary-500 border-r-secondary-500 border-l-secondary-800 hover:border-l-secondary-500',
    success:
      'border-y-success-500 border-r-success-500 border-l-success-700 hover:border-l-success-500',
    error:
      'border-y-error-500 border-r-error-500 border-l-error-800 hover:border-l-error-500',
    warning:
      'border-y-warning-500 border-r-warning-500 border-l-warning-800 hover:border-l-warning-500',
    'accent-purple':
      'border-y-accent-purple-500 border-r-accent-purple-500 border-l-accent-purple-700 hover:border-l-accent-purple-500',
    'accent-falcon':
      'border-y-accent-falcon-500 border-r-accent-falcon-500 border-l-accent-falcon-700 hover:border-l-accent-falcon-500',
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
  onClick,
  className = '',
}: CardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const colorClasses = getCardColorClasses(color);
  const sizeClasses = getCardSizeClasses(size);

  return (
    <div
      className={`text-neutral-50 border-y border-r rounded-lg relative transition-all duration-300 group isolate ${colorClasses} border-l-8 ${sizeClasses} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <DotGridBackground color={color} active={isHovered} />
      {children}
    </div>
  );
};
