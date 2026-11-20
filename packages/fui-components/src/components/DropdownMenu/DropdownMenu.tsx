import React, { useCallback, useRef } from 'react';
import * as RDM from '@radix-ui/react-dropdown-menu';
import { Cross1Icon } from '@radix-ui/react-icons';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import {
  MenuPanel,
  useComposedRefs,
  menuContentClassName,
  useClipReveal,
} from './menuShared';

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
  ref,
  ...props
}) => {
  const revealRef = useClipReveal(animated);
  const contentRef = useComposedRefs(revealRef, ref);

  return (
    <RDM.Portal container={container}>
      <RDM.Content
        {...props}
        ref={contentRef}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={extendedTwMerge(
          menuContentClassName,
          'min-w-[380px]',
          // Never taller than the room left in the viewport: the item list scrolls instead.
          'max-h-[var(--radix-dropdown-menu-content-available-height)]',
          className,
        )}
      >
        <MenuPanel
          label={label}
          scrollBody
          headerAction={
            label &&
            showClose && (
              <RDM.Item
                className="absolute right-3 cursor-pointer outline-none hover:text-primary-300 transition-colors"
                aria-label="Close"
              >
                <Cross1Icon />
              </RDM.Item>
            )
          }
        >
          <div className="flex-1">{children}</div>
        </MenuPanel>
      </RDM.Content>
    </RDM.Portal>
  );
};
