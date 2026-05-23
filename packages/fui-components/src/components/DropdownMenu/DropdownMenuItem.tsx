import React, { useCallback, useContext, useRef } from 'react';
import * as RDM from '@radix-ui/react-dropdown-menu';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';
import { DropdownCloseCtx } from './DropdownMenu';

const PRIMARY_500 = '#3AFCFF';
const NEUTRAL_900 = '#23272B';
const FLASH_MS = 75;
const FLASH_COUNT = 2;

const flashItem = (el: HTMLElement, onDone: () => void) => {
  let count = 0;
  const on = () => {
    el.style.backgroundColor = PRIMARY_500;
    el.style.color = NEUTRAL_900;
  };
  const off = () => {
    el.style.backgroundColor = NEUTRAL_900;
    el.style.color = PRIMARY_500;
  };
  const tick = () => {
    if (count >= FLASH_COUNT) {
      el.style.backgroundColor = '';
      el.style.color = '';
      setTimeout(onDone, 20);
      return;
    }
    on();
    setTimeout(() => {
      off();
      setTimeout(() => {
        count++;
        tick();
      }, FLASH_MS);
    }, FLASH_MS);
  };
  tick();
};

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
      className={extendedTwMerge(
        'flex items-center gap-3 px-3 py-2 text-neutral-300',
        'cursor-pointer outline-none transition-colors duration-200',
        'data-[highlighted]:bg-primary-500 data-[highlighted]:text-neutral-900',
        className,
      )}
      {...props}
    >
      {Icon && <Icon width={20} height={20} />}
      <Typography
        variant="button"
        component="span"
        className="text-inherit grow"
      >
        {children}
      </Typography>
      {RightIcon && <RightIcon width={16} height={16} className="opacity-60" />}
    </RDM.Item>
  );
};
