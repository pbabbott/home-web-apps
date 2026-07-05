'use client';

import { Suspense, use } from 'react';
import type { ElementType } from 'react';
import type { SimpleIcon } from 'simple-icons';
import * as RadixIcons from '@radix-ui/react-icons';
import type { IconProps } from './types';
import { loadIcon } from './loaders';
import { lookupById } from './registry';
import { CUSTOM_ICONS } from './customIconsMap';

const fallback = (size: number) => (
  <span
    style={{ display: 'inline-block', width: size, height: size }}
    aria-hidden="true"
  />
);

// simple-icons renderer
interface ResolvedSimpleIconProps {
  slug: string;
  size: number;
  colored: boolean;
  className?: string;
  ariaLabel: string;
}

function ResolvedSimpleIcon({
  slug,
  size,
  colored,
  className,
  ariaLabel,
}: ResolvedSimpleIconProps) {
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

  const ariaLabel = title ?? def.label;

  if (def.source === 'custom') {
    const CustomComponent = CUSTOM_ICONS[def.slug];
    if (!CustomComponent) return null;
    return (
      <CustomComponent
        size={size}
        className={['text-neutral-200', className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      />
    );
  }

  if (def.source === 'radix') {
    const RadixComponent = RadixIcons[def.slug as keyof typeof RadixIcons] as
      | ElementType
      | undefined;
    if (!RadixComponent) return null;
    return (
      <RadixComponent
        width={size}
        height={size}
        className={['text-neutral-200', className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      />
    );
  }

  // source === 'simple'
  return (
    <Suspense fallback={fallback(size)}>
      <ResolvedSimpleIcon
        slug={def.slug}
        size={size}
        colored={colored}
        className={
          colored
            ? className
            : ['text-neutral-200', className].filter(Boolean).join(' ')
        }
        ariaLabel={ariaLabel}
      />
    </Suspense>
  );
}
