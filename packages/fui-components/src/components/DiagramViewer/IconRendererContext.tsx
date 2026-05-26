/* eslint-disable react-refresh/only-export-components */
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { IconRenderer } from '../../types/icons';

const IconRendererContext = createContext<IconRenderer | undefined>(undefined);

export function IconRendererProvider({
  renderer,
  children,
}: {
  renderer?: IconRenderer;
  children: ReactNode;
}) {
  return (
    <IconRendererContext.Provider value={renderer}>
      {children}
    </IconRendererContext.Provider>
  );
}

export function useIconRenderer(): IconRenderer | undefined {
  return useContext(IconRendererContext);
}
