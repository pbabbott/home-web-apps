import { ReactNode } from 'react';

interface AnimatedGradientProps {
  children?: ReactNode;
  className?: string;
  isAnimated: boolean;
}

export default function AnimatedGradient({
  children,
  className = '',
  isAnimated,
}: AnimatedGradientProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-700" />
      <div
        className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-primary-800 transition-all duration-2000 ease-in-out"
        style={{
          clipPath: isAnimated ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
          transitionDuration: '3000ms',
          transitionDelay: '1000ms',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
