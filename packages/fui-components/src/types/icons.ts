import type { ReactNode } from 'react';

export interface IconProps {
  name: string;
  size?: number;
  colored?: boolean;
  className?: string;
  title?: string;
}

export type IconRenderer = (props: IconProps) => ReactNode;
