import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';

export type TableColor = 'primary' | 'secondary' | 'neutral';

const borderColorClasses: Record<TableColor, string> = {
  primary: 'border-primary-500',
  secondary: 'border-secondary-500',
  neutral: 'border-neutral-500',
};

export type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  color?: TableColor;
};

export const Table = ({
  className,
  color = 'primary',
  ...props
}: TableProps) => (
  <table
    className={extendedTwMerge(
      'border border-collapse w-full',
      borderColorClasses[color],
      className,
    )}
    {...props}
  />
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
};

export const Th = ({
  className,
  color = 'primary',
  children,
  ...props
}: ThProps) => (
  <th
    scope="col"
    className={extendedTwMerge(
      'border px-3 py-2 text-left',
      borderColorClasses[color],
      className,
    )}
    {...props}
  >
    <Typography variant="body2" component="span">
      {children}
    </Typography>
  </th>
);

export type TdProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  color?: TableColor;
};

export const Td = ({
  className,
  color = 'primary',
  children,
  ...props
}: TdProps) => (
  <td
    className={extendedTwMerge(
      'border px-3 py-2',
      borderColorClasses[color],
      className,
    )}
    {...props}
  >
    <Typography variant="body2" component="span">
      {children}
    </Typography>
  </td>
);
