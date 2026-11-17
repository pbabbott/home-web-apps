import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { listItemColorTokens, type ListItemColor } from './listItemColors';
import { ListItemContent, listItemBaseClasses } from './ListItemContent';

export type { ListItemColor };

export interface ListItemProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  children: React.ReactNode;
  /** Translucent fill. Omit for a transparent row. */
  color?: ListItemColor;
  /** Shown before the text, e.g. a Badge or icon. */
  startAdornment?: React.ReactNode;
  /** Shown after the text, pushed to the far edge. */
  endAdornment?: React.ReactNode;
  /** Element to render as. Defaults to `li`. */
  component?: React.ElementType;
}

/** A static (non-interactive) row for lists. See `ListItemButton` for a
 * clickable or selectable row. */
export const ListItem = React.forwardRef<HTMLElement, ListItemProps>(
  function ListItem(
    {
      children,
      startAdornment,
      endAdornment,
      component: Component = 'li',
      color,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <Component
        ref={ref}
        className={extendedTwMerge(
          listItemBaseClasses,
          color && listItemColorTokens[color].fill,
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
  },
);
