import React, { useCallback, useContext, useRef } from 'react';
import * as RDM from '@radix-ui/react-dropdown-menu';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { DropdownCloseCtx } from './DropdownMenu';
import { MenuItemLabel, flashItem, menuItemClassName } from './menuShared';

export interface DropdownMenuItemProps
  extends React.ComponentProps<typeof RDM.Item> {
  icon?: React.ElementType;
  rightIcon?: React.ElementType;
  children?: React.ReactNode;
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  icon: Icon,
  rightIcon: RightIcon,
  className,
  children,
  onSelect,
  ...props
}) => {
  const close = useContext(DropdownCloseCtx);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (e: Event) => {
      e.preventDefault();
      const el = itemRef.current;
      if (!el) {
        onSelect?.(e);
        close();
        return;
      }
      flashItem(el, () => {
        onSelect?.(e);
        close();
      });
    },
    [onSelect, close],
  );

  return (
    <RDM.Item
      ref={itemRef}
      onSelect={handleSelect}
      className={extendedTwMerge(menuItemClassName, className)}
      {...props}
    >
      {Icon && <Icon width={20} height={20} />}
      <MenuItemLabel>{children}</MenuItemLabel>
      {RightIcon && <RightIcon width={16} height={16} className="opacity-60" />}
    </RDM.Item>
  );
};
