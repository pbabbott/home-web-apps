import React from 'react';
import { Typography } from '../Typography/Typography';

export interface ListItemContentProps {
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  children: React.ReactNode;
}

/** Internal only — not exported from the package. The inner layout shared by
 * ListItem and ListItemButton: start adornment, wrapping text, end adornment. */
export const ListItemContent: React.FC<ListItemContentProps> = ({
  startAdornment,
  endAdornment,
  children,
}) => (
  <>
    {startAdornment !== undefined && (
      <span className="flex shrink-0 items-center">{startAdornment}</span>
    )}
    <Typography variant="body2" component="span" className="min-w-0 break-all">
      {children}
    </Typography>
    {endAdornment !== undefined && (
      <span className="ml-auto flex shrink-0 items-center">{endAdornment}</span>
    )}
  </>
);

export const listItemBaseClasses = 'flex items-center gap-2 px-2 py-1';
