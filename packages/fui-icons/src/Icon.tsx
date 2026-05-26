'use client';

import { Suspense, use } from 'react';
import type { SimpleIcon } from 'simple-icons';
import type { IconProps } from './types';
import { loadIcon } from './loaders';
import { lookupById } from './registry';

interface ResolvedIconProps {
  slug: string;
  size: number;
  colored: boolean;
  className?: string;
  ariaLabel: string;
}

function ResolvedIcon({
  slug,
  size,
  colored,
  className,
  ariaLabel,
}: ResolvedIconProps) {
  const icon = use(loadIcon(slug)) as SimpleIcon | null;
  if (!icon) return null;
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={colored ? `#${icon.hex}` : 'currentColor'}
    >
      <path d={icon.path} />
    </svg>
  );
}

export function Icon({
  name,
  size = 16,
  colored = false,
  className,
  title,
}: IconProps) {
  const def = lookupById(name);
  if (!def) return null;
  return (
    <Suspense
      fallback={
        <span
          style={{ display: 'inline-block', width: size, height: size }}
          aria-hidden="true"
        />
      }
    >
      <ResolvedIcon
        slug={def.slug}
        size={size}
        colored={colored}
        className={className}
        ariaLabel={title ?? def.label}
      />
    </Suspense>
  );
}
