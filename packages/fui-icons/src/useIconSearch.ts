'use client';

import { useMemo } from 'react';
import type { FuiIconDefinition, IconSource } from './types';
import { ICON_REGISTRY } from './registry';

const MAX_RESULTS = 30;

export function useIconSearch(
  query: string,
  source?: IconSource,
): FuiIconDefinition[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = source
      ? ICON_REGISTRY.filter((icon) => icon.source === source)
      : ICON_REGISTRY;
    if (!q) return pool.slice(0, MAX_RESULTS);
    return pool
      .filter(
        (icon) =>
          icon.id.includes(q) ||
          icon.label.toLowerCase().includes(q) ||
          icon.keywords?.some((k) => k.includes(q)),
      )
      .slice(0, MAX_RESULTS);
  }, [query, source]);
}
