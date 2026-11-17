import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import {
  listItemColorTokens,
  type ListItemColor,
} from '../ListItem/listItemColors';
import {
  ListItemContent,
  listItemBaseClasses,
} from '../ListItem/ListItemContent';

export type ListItemButtonColor = ListItemColor;

export interface ListItemButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: React.ReactNode;
  /** Fill color; translucent so the surface behind shows through. */
  color?: ListItemButtonColor;
  /** Marks this row as the current selection (also sets `aria-pressed`). */
  selected?: boolean;
  /** Shown before the text, e.g. a Badge or icon. */
  startAdornment?: React.ReactNode;
  /** Shown after the text, pushed to the far edge. */
  endAdornment?: React.ReactNode;
  /** Element to render as, e.g. `a`. Defaults to `button`. */
  component?: React.ElementType;
  href?: string;
}

/** A clickable / selectable list row with a translucent, colorable fill. */
export const ListItemButton = React.forwardRef<
  HTMLButtonElement,
  ListItemButtonProps
>(function ListItemButton(
  {
    children,
    color = 'neutral',
    selected = false,
    startAdornment,
    endAdornment,
    component,
    className,
    ...props
  },
  ref,
) {
  const Component = component ?? 'button';

  return (
    <Component
      ref={ref}
      {...(!component && { type: 'button' })}
      aria-pressed={selected}
      className={extendedTwMerge(
        listItemBaseClasses,
        'w-full cursor-pointer text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        listItemColorTokens[color].hover,
        selected && listItemColorTokens[color].selected,
        className,
      )}
      {...props}
    >
      <ListItemContent
        startAdornment={startAdornment}
        endAdornment={endAdornment}
      >
        {children}
      </ListItemContent>
    </Component>
  );
});
