import type { FC } from 'react';
import type { SvgIconProps } from './customIcons';
import { BananaIcon, HaproxyIcon, RouterIcon } from './customIcons';

export const CUSTOM_ICONS: Record<string, FC<SvgIconProps>> = {
  banana: BananaIcon,
  haproxy: HaproxyIcon,
  router: RouterIcon,
};
