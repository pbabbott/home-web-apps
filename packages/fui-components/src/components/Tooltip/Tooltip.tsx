import React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';

export interface TooltipProps
  extends Pick<
    React.ComponentProps<typeof RadixTooltip.Content>,
    'side' | 'align' | 'sideOffset'
  > {
  /** Text (or nodes) shown in the tooltip. */
  content: React.ReactNode;
  /** The element that triggers the tooltip. Must accept a ref and DOM props. */
  children: React.ReactElement;
  /** Milliseconds to wait before opening on hover. */
  delayDuration?: number;
  /** Controlled open state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  delayDuration = 200,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  open,
  defaultOpen,
  onOpenChange,
  className,
}) => (
  <RadixTooltip.Provider delayDuration={delayDuration}>
    <RadixTooltip.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={extendedTwMerge(
            'z-50 max-w-xs border border-primary-700 bg-neutral-900/30 px-3 py-2 backdrop-blur-sm',
            className,
          )}
        >
          <Typography variant="body2" component="div">
            {content}
          </Typography>
          <RadixTooltip.Arrow className="fill-primary-700" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>
);
