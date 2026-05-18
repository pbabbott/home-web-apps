'use client';
import { useState } from 'react';
import {
  accentPurple,
  accentFalcon,
  primary,
  secondary,
  warning,
  error,
  gradient,
} from '@abbottland/fui-components';

interface GradientMockImageProps {
  className?: string;
  seed?: string | number; // Optional seed for deterministic gradient selection
}

// All the gradients that were previously used in blogPosts.ts
const gradients = [
  gradient(accentPurple[400], accentPurple[600]),
  gradient(accentFalcon[400], error.DEFAULT),
  gradient(secondary.DEFAULT, primary[700]),
  gradient(primary[200], accentFalcon[100]),
  gradient(warning[50], warning.DEFAULT),
  gradient(primary[500], accentPurple.DEFAULT),
  gradient(error.DEFAULT, warning[200]),
  gradient(accentPurple[200], accentFalcon[200]),
];

export default function GradientMockImage({
  className = '',
  seed,
}: GradientMockImageProps) {
  // Use seed if provided for deterministic selection, otherwise random (stable per component instance)
  const selectedGradient = useState(() => {
    if (seed !== undefined) {
      // Simple hash function for deterministic selection based on seed
      const hash =
        typeof seed === 'string'
          ? seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
          : seed;
      return gradients[Math.abs(hash) % gradients.length];
    }
    return gradients[Math.floor(Math.random() * gradients.length)];
  })[0];

  return (
    <div
      className={`w-full h-full ${className}`}
      style={{ background: selectedGradient }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-3xl opacity-20 font-mono tracking-tighter">
          {'</>'}
        </div>
      </div>
    </div>
  );
}
