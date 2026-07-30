import React, { createContext, useContext } from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';

export type TableColor = 'primary' | 'secondary' | 'neutral';

const borderColorClasses: Record<TableColor, string> = {
  primary: 'border-primary-500',
  secondary: 'border-secondary-500',
  neutral: 'border-neutral-500',
};

/**
 * 'small' trades the design system's default display-sized body2 text
 * (28px, meant for hero copy) for a size that reads as an actual data
 * table. Set once on `Table` and read by Th/Td via context, rather than
 * repeated on every cell, since a table is either dense or it isn't.
 */
export type TableSize = 'default' | 'small';

const TableSizeContext = createContext<TableSize>('default');

const tableCellPaddingClasses: Record<TableSize, string> = {
  default: 'px-3 py-2',
  small: 'px-2 py-1',
};

const tableCellTextClasses: Record<TableSize, string> = {
  default: '',
  small: 'text-[0.875rem] leading-snug',
};

export type ScrollableTableProps = React.HTMLAttributes<HTMLDivElement>;

// A table with `w-full` still expands past its container when content
// (long cell text, many columns) can't shrink to fit — this wrapper
// contains that overflow in a scrollable box instead of letting it blow
// out the page.
export const ScrollableTable = ({
  className,
  ...props
}: ScrollableTableProps) => (
  <div
    className={extendedTwMerge('overflow-x-auto w-full mb-8', className)}
    {...props}
  />
);

export type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  color?: TableColor;
  size?: TableSize;
};

export const Table = ({
  className,
  color = 'primary',
  size = 'default',
  ...props
}: TableProps) => (
  <TableSizeContext.Provider value={size}>
    <table
      className={extendedTwMerge(
        'border border-collapse w-full',
        borderColorClasses[color],
        className,
      )}
      {...props}
    />
  </TableSizeContext.Provider>
);

export type TableHeadProps = React.HTMLAttributes<HTMLTableSectionElement>;

export const TableHead = ({ className, ...props }: TableHeadProps) => (
  <thead className={extendedTwMerge(className)} {...props} />
);

export type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;

export const TableBody = ({ className, ...props }: TableBodyProps) => (
  <tbody className={extendedTwMerge(className)} {...props} />
);

export type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>;

export const TableRow = ({ className, ...props }: TableRowProps) => (
  <tr className={extendedTwMerge(className)} {...props} />
);

export type ThProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  color?: TableColor;
  size?: TableSize;
};

export const Th = ({
  className,
  color = 'primary',
  size,
  children,
  ...props
}: ThProps) => {
  const contextSize = useContext(TableSizeContext);
  const resolvedSize = size ?? contextSize;

  return (
    <th
      scope="col"
      className={extendedTwMerge(
        'border text-left',
        tableCellPaddingClasses[resolvedSize],
        tableCellTextClasses[resolvedSize],
        borderColorClasses[color],
        className,
      )}
      {...props}
    >
      <Typography
        variant="body2"
        component="span"
        className={tableCellTextClasses[resolvedSize]}
      >
        {children}
      </Typography>
    </th>
  );
};

export type TdProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  color?: TableColor;
  size?: TableSize;
};

export const Td = ({
  className,
  color = 'primary',
  size,
  children,
  ...props
}: TdProps) => {
  const contextSize = useContext(TableSizeContext);
  const resolvedSize = size ?? contextSize;

  return (
    <td
      className={extendedTwMerge(
        'border',
        tableCellPaddingClasses[resolvedSize],
        tableCellTextClasses[resolvedSize],
        borderColorClasses[color],
        className,
      )}
      {...props}
    >
      <Typography
        variant="body2"
        component="span"
        className={tableCellTextClasses[resolvedSize]}
      >
        {children}
      </Typography>
    </td>
  );
};
