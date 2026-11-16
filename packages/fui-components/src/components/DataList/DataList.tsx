import React, { createContext, useContext } from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';

export type DataListColor = 'primary' | 'secondary' | 'neutral';
export type DataListSize = 'default' | 'small';
export type DataListOrientation = 'horizontal' | 'vertical';
export type DataListAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
/** State signal for a value. Color means state, not decoration. */
export type DataListValueColor =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error';

interface DataListContextValue {
  orientation: DataListOrientation;
  size: DataListSize;
  color: DataListColor;
}

const DataListContext = createContext<DataListContextValue>({
  orientation: 'horizontal',
  size: 'default',
  color: 'neutral',
});

/**
 * Row separator: a hairline that starts bright at the left and fades out to the
 * right (the `HorizontalRule` gradient, one-sided), anchored by a small square
 * tick at its origin like a ruler mark. Drawn with pseudo-elements so it adds
 * no height to the row. Static class strings so Tailwind can see them.
 */
const DIVIDER_BASE =
  'relative before:absolute before:bottom-0 before:left-0 before:size-[3px] after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-gradient-to-r after:to-transparent';

const dividerClasses: Record<DataListColor, string> = {
  primary:
    'before:bg-primary-500 after:from-primary-700 after:via-primary-900/70',
  secondary:
    'before:bg-secondary-500 after:from-secondary-700 after:via-secondary-900/70',
  neutral:
    'before:bg-neutral-500 after:from-neutral-600 after:via-neutral-800/70',
};

const itemPaddingClasses: Record<DataListSize, string> = {
  default: 'py-3',
  small: 'py-1.5',
};

const alignClasses: Record<DataListAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
};

const valueColorClasses: Record<DataListValueColor, string> = {
  default: 'text-neutral-50',
  primary: 'text-primary-400',
  success: 'text-success-400',
  warning: 'text-warning-400',
  error: 'text-error-400',
};

const DEFAULT_LABEL_WIDTH = '10rem';

export type DataListRootProps = React.HTMLAttributes<HTMLDListElement> & {
  orientation?: DataListOrientation;
  size?: DataListSize;
  /** Tints the hairline dividers between items. */
  color?: DataListColor;
};

export const DataListRoot = React.forwardRef<
  HTMLDListElement,
  DataListRootProps
>(function DataListRoot(
  {
    orientation = 'horizontal',
    size = 'default',
    color = 'neutral',
    className,
    ...props
  },
  ref,
) {
  return (
    <DataListContext.Provider value={{ orientation, size, color }}>
      <dl
        ref={ref}
        data-orientation={orientation}
        data-color={color}
        className={extendedTwMerge('m-0 flex flex-col', className)}
        {...props}
      />
    </DataListContext.Provider>
  );
});

export type DataListItemProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Cross-axis alignment of label and value (horizontal orientation). */
  align?: DataListAlign;
};

export const DataListItem = React.forwardRef<HTMLDivElement, DataListItemProps>(
  function DataListItem({ align = 'baseline', className, ...props }, ref) {
    const { orientation, size, color } = useContext(DataListContext);
    return (
      <div
        ref={ref}
        className={extendedTwMerge(
          'flex',
          DIVIDER_BASE,
          dividerClasses[color],
          orientation === 'horizontal'
            ? ['flex-row gap-x-4', alignClasses[align]]
            : 'flex-col gap-y-1',
          itemPaddingClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

export type DataListLabelProps = React.HTMLAttributes<HTMLElement> & {
  /** CSS width of the label column (horizontal orientation only). */
  width?: string;
};

export const DataListLabel = React.forwardRef<HTMLElement, DataListLabelProps>(
  function DataListLabel(
    { width = DEFAULT_LABEL_WIDTH, className, style, children, ...props },
    ref,
  ) {
    const { orientation } = useContext(DataListContext);
    return (
      <dt
        ref={ref}
        className={extendedTwMerge(
          // text-caption/text-body2 are set on the cell itself, not just the inner
          // Typography: a block holding only inline content sizes its line box from
          // its *own* font-size/line-height (the strut), which here would be the
          // 28px body at the browser's default 1.5 (42px) — dead space per row. Line heights are then pinned to whole pixels
          // (.8 × 22/28px is fractional) so the 1px dividers land on pixel boundaries.
          'm-0 shrink-0 text-caption leading-[18px]',
          orientation === 'horizontal' && 'min-w-0',
          className,
        )}
        style={orientation === 'horizontal' ? { width, ...style } : style}
        {...props}
      >
        {/* Labels are dim: they give context after the value registers. */}
        <Typography
          variant="caption"
          component="span"
          className="leading-[inherit] text-neutral-600"
        >
          {children}
        </Typography>
      </dt>
    );
  },
);

export type DataListValueProps = React.HTMLAttributes<HTMLElement> & {
  color?: DataListValueColor;
};

export const DataListValue = React.forwardRef<HTMLElement, DataListValueProps>(
  function DataListValue(
    { color = 'default', className, children, ...props },
    ref,
  ) {
    return (
      <dd
        ref={ref}
        className={extendedTwMerge(
          'm-0 min-w-0 flex-1 text-body2 leading-[22px]',
          className,
        )}
        {...props}
      >
        <Typography
          variant="body2"
          component="span"
          className={extendedTwMerge(
            'leading-[inherit]',
            valueColorClasses[color],
          )}
        >
          {children}
        </Typography>
      </dd>
    );
  },
);

/** Radix-Themes-style namespace: `<DataList.Root>`, `.Item`, `.Label`, `.Value`. */
// eslint-disable-next-line react-refresh/only-export-components -- plain namespace object of components
export const DataList = {
  Root: DataListRoot,
  Item: DataListItem,
  Label: DataListLabel,
  Value: DataListValue,
};
