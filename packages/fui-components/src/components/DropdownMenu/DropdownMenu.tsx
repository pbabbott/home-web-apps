import React, { useCallback, useRef } from 'react';
import * as RDM from '@radix-ui/react-dropdown-menu';
import { Cross1Icon } from '@radix-ui/react-icons';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';
import { DottedDecoration } from './DottedDecoration';
import { LBracket, useClipReveal } from './menuShared';

import { DropdownCloseCtx } from './DropdownCloseCtx';
export { DropdownCloseCtx };

export const DropdownMenu: React.FC<React.ComponentProps<typeof RDM.Root>> = ({
  onOpenChange,
  children,
  ...props
}) => {
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const close = useCallback(() => onOpenChangeRef.current?.(false), []);
  return (
    <DropdownCloseCtx.Provider value={close}>
      <RDM.Root onOpenChange={onOpenChange} {...props}>
        {children}
      </RDM.Root>
    </DropdownCloseCtx.Provider>
  );
};

export const DropdownMenuTrigger = RDM.Trigger;

export interface DropdownMenuContentProps
  extends React.ComponentProps<typeof RDM.Content> {
  label?: string;
  showClose?: boolean;
  animated?: boolean;
  /** Element to portal the menu into (defaults to document.body). */
  container?: HTMLElement | null;
  children?: React.ReactNode;
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  label,
  showClose,
  animated = true,
  container,
  className,
  children,
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}) => {
  const contentRef = useClipReveal(animated);

  return (
    <RDM.Portal container={container}>
      <RDM.Content
        ref={contentRef}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={extendedTwMerge(
          'relative z-50 flex min-w-[380px] flex-col bg-neutral-900/30 backdrop-blur-sm',
          // Never taller than the room left in the viewport: the item list scrolls instead.
          'max-h-[var(--radix-dropdown-menu-content-available-height)]',
          'border border-primary-700 text-neutral-300 pb-3 px-2',
          className,
        )}
        {...props}
      >
        <LBracket position="top-left" />
        <LBracket position="bottom-left" />
        <LBracket position="bottom-right" />

        {label && (
          <div className="relative flex items-center justify-center px-8 py-2 border-b border-primary-900 text-primary-500 tracking-wider">
            <Typography variant="caption" component="span">
              {label}
            </Typography>
            {showClose && (
              <RDM.Item
                className="absolute right-3 cursor-pointer outline-none hover:text-primary-300 transition-colors"
                aria-label="Close"
              >
                <Cross1Icon />
              </RDM.Item>
            )}
          </div>
        )}
        <div
          className={extendedTwMerge(
            'flex min-h-0 overflow-y-auto px-2 pb-1',
            // Without a label header, push items down level with the corner brackets.
            label ? 'pt-1' : 'pt-3',
          )}
        >
          <div className="flex-1">{children}</div>
          <DottedDecoration className="text-primary-700 opacity-60 self-center pr-1" />
        </div>
      </RDM.Content>
    </RDM.Portal>
  );
};
