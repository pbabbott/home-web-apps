import type { ButtonColor } from '../buttonColorTokens';

export type ListItemColor = ButtonColor | 'dark';

interface ListItemColorTokens {
  /** ListItem: always-on translucent fill. */
  fill: string;
  /** ListItemButton: fill on hover. */
  hover: string;
  /** ListItemButton: fill when selected. */
  selected: string;
}

/** Internal only. Written out as literal classes because Tailwind's scanner
 * can't see built-up class names. */
export const listItemColorTokens: Record<ListItemColor, ListItemColorTokens> = {
  neutral: {
    fill: 'bg-neutral-500/20',
    hover: 'not-disabled:hover:bg-neutral-500/20',
    selected: 'bg-neutral-500/40',
  },
  primary: {
    fill: 'bg-primary-500/20',
    hover: 'not-disabled:hover:bg-primary-500/20',
    selected: 'bg-primary-500/40',
  },
  secondary: {
    fill: 'bg-secondary-500/20',
    hover: 'not-disabled:hover:bg-secondary-500/20',
    selected: 'bg-secondary-500/40',
  },
  success: {
    fill: 'bg-success-500/20',
    hover: 'not-disabled:hover:bg-success-500/20',
    selected: 'bg-success-500/40',
  },
  error: {
    fill: 'bg-error-500/20',
    hover: 'not-disabled:hover:bg-error-500/20',
    selected: 'bg-error-500/40',
  },
  warning: {
    fill: 'bg-warning-500/20',
    hover: 'not-disabled:hover:bg-warning-500/20',
    selected: 'bg-warning-500/40',
  },
  'accent-purple': {
    fill: 'bg-accent-purple-500/20',
    hover: 'not-disabled:hover:bg-accent-purple-500/20',
    selected: 'bg-accent-purple-500/40',
  },
  // A darkening scrim rather than a tint: same idea as TransparentPanel's `dark`.
  dark: {
    fill: 'bg-neutral-900/60',
    hover: 'not-disabled:hover:bg-neutral-900/40',
    selected: 'bg-neutral-900/80',
  },
  'accent-falcon': {
    fill: 'bg-accent-falcon-500/20',
    hover: 'not-disabled:hover:bg-accent-falcon-500/20',
    selected: 'bg-accent-falcon-500/40',
  },
};
