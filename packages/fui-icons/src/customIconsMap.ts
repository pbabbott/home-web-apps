import type { FC } from 'react';
import type { SvgIconProps } from './customIcons';
import { HaproxyIcon } from './customIcons';

export const CUSTOM_ICONS: Record<string, FC<SvgIconProps>> = {
  haproxy: HaproxyIcon,
};
