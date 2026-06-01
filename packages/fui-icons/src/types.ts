import type { ReactNode } from 'react';

export type IconSource = 'simple' | 'custom' | 'radix';

export interface IconProps {
  name: string;
  size?: number;
  colored?: boolean;
  className?: string;
  title?: string;
}

export type IconRenderer = (props: IconProps) => ReactNode;

export interface FuiIconDefinition {
  id: string;
  label: string;
  slug: string;
  source: IconSource;
  keywords?: string[];
}
