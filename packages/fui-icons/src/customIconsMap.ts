import type { FC } from 'react';
import type { SvgIconProps } from './customIcons';
import {
  BananaIcon,
  CylinderIcon,
  DuckDnsIcon,
  HaproxyIcon,
  RouterIcon,
} from './customIcons';

export const CUSTOM_ICONS: Record<string, FC<SvgIconProps>> = {
  banana: BananaIcon,
  cylinder: CylinderIcon,
  duckdns: DuckDnsIcon,
  haproxy: HaproxyIcon,
  router: RouterIcon,
};
