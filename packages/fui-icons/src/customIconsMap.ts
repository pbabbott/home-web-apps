import type { FC } from 'react';
import type { SvgIconProps } from './customIcons';
import {
  BananaIcon,
  CylinderIcon,
  DuckDnsIcon,
  FolderIcon,
  HaproxyIcon,
  HardDriveIcon,
  MinusIcon,
  PlusIcon,
  RouterIcon,
  TargetIcon,
} from './customIcons';

export const CUSTOM_ICONS: Record<string, FC<SvgIconProps>> = {
  banana: BananaIcon,
  cylinder: CylinderIcon,
  duckdns: DuckDnsIcon,
  folder: FolderIcon,
  haproxy: HaproxyIcon,
  'hard-drive': HardDriveIcon,
  minus: MinusIcon,
  plus: PlusIcon,
  router: RouterIcon,
  target: TargetIcon,
};
