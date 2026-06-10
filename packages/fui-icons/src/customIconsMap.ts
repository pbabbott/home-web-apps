import type { FC } from 'react';
import type { SvgIconProps } from './customIcons';
import {
  BananaIcon,
  CylinderIcon,
  DuckDnsIcon,
  FolderIcon,
  HaproxyIcon,
  HardDriveIcon,
  RouterIcon,
} from './customIcons';

export const CUSTOM_ICONS: Record<string, FC<SvgIconProps>> = {
  banana: BananaIcon,
  cylinder: CylinderIcon,
  duckdns: DuckDnsIcon,
  folder: FolderIcon,
  haproxy: HaproxyIcon,
  'hard-drive': HardDriveIcon,
  router: RouterIcon,
};
