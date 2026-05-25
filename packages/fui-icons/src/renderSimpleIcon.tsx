'use client';

import type { IconRenderer } from './types';
import { Icon } from './Icon';

export const renderSimpleIcon: IconRenderer = (props) => <Icon {...props} />;
