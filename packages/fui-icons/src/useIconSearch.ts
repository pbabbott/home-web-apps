'use client';

import { useMemo } from 'react';
import type { FuiIconDefinition } from './types';
import { ICON_REGISTRY } from './registry';

const MAX_RESULTS = 30;

export function useIconSearch(query: string): FuiIconDefinition[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_REGISTRY.slice(0, MAX_RESULTS);
    return ICON_REGISTRY.filter(
      (icon) =>
        icon.id.includes(q) ||
        icon.label.toLowerCase().includes(q) ||
        icon.keywords?.some((k) => k.includes(q)),
    ).slice(0, MAX_RESULTS);
  }, [query]);
}
