import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as RS from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';
import {
  MenuItemLabel,
  MenuPanel,
  useComposedRefs,
  flashItem,
  menuContentClassName,
  menuItemClassName,
  useClipReveal,
} from '../DropdownMenu/menuShared';

interface SelectCtxValue {
  /** Items register their element so the root can flash it on selection. */
  register: (value: string, el: HTMLElement | null) => void;
  unregister: (value: string, el: HTMLElement) => void;
}

const SelectCtx = createContext<SelectCtxValue>({
  register: () => {},
  unregister: () => {},
});

export interface SelectProps
  extends Omit<React.ComponentProps<typeof RS.Root>, 'open'> {
  open?: boolean;
}

/**
 * Select root. Value and open state are managed here (controlled or not) so
 * that SelectItem can play the DropdownMenu confirm flash before committing.
 *
 * Controlled-ness is decided by whether the `value` prop is passed at all, so
 * `value={undefined}` means "controlled, nothing selected" (shows the
 * placeholder) rather than falling back to internal state.
 */
export const Select: React.FC<SelectProps> = (allProps) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
  } = allProps;
  const valueControlled = 'value' in allProps;
  const [valueState, setValueState] = useState(defaultValue);
  const [openState, setOpenState] = useState(defaultOpen);
  const value = valueControlled ? valueProp : valueState;
  const open = openProp !== undefined ? openProp : openState;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const itemEls = useRef(new Map<string, HTMLElement>());
  const flashing = useRef(false);
  const cancelFlash = useRef<(() => void) | null>(null);

  // Drop a pending flash if the Select unmounts mid-flash, so the callbacks
  // don't fire after the component is gone.
  useEffect(
    () => () => {
      cancelFlash.current?.();
      cancelFlash.current = null;
      flashing.current = false;
    },
    [],
  );

  // `el` is only removed if it is still the registered element: Radix mounts
  // items in a detached fragment while closed, and that copy unmounting must
  // not evict the live one.
  const register = useCallback((v: string, el: HTMLElement | null) => {
    if (el) itemEls.current.set(v, el);
  }, []);
  const unregister = useCallback((v: string, el: HTMLElement) => {
    if (itemEls.current.get(v) === el) itemEls.current.delete(v);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    // Radix closes right after selecting; hold it open for the confirm flash.
    if (!next && flashing.current) return;
    setOpenState(next);
    onOpenChangeRef.current?.(next);
  }, []);

  const commit = useCallback(
    (next: string) => {
      flashing.current = false;
      cancelFlash.current = null;
      setValueState(next);
      onValueChangeRef.current?.(next);
      handleOpenChange(false);
    },
    [handleOpenChange],
  );

  // Flash-confirm the chosen item (same as DropdownMenuItem), then commit.
  const handleValueChange = useCallback(
    (next: string) => {
      // A second pick while the flash is playing must not commit twice.
      if (flashing.current) return;
      const el = itemEls.current.get(next);
      if (!el || !el.isConnected) {
        commit(next);
        return;
      }
      flashing.current = true;
      cancelFlash.current = flashItem(el, () => commit(next));
    },
    [commit],
  );

  const ctx = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <SelectCtx.Provider value={ctx}>
      <RS.Root
        // Always controlled; '' makes Radix show the placeholder.
        value={value ?? ''}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </RS.Root>
    </SelectCtx.Provider>
  );
};

export type SelectSize = 'default' | 'small';

// Mirrors the button sizes (see buttonSizeClasses) so a small Select sits
// level with small buttons.
const triggerSizeClasses: Record<SelectSize, string> = {
  default: 'px-3 py-2 gap-3',
  small: 'px-2.5 py-1 gap-2',
};

export interface SelectTriggerProps
  extends React.ComponentProps<typeof RS.Trigger> {
  placeholder?: string;
  size?: SelectSize;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  placeholder,
  size = 'default',
  className,
  ...props
}) => (
  <RS.Trigger
    className={extendedTwMerge(
      'group inline-flex min-w-[200px] items-center justify-between',
      triggerSizeClasses[size],
      'border border-neutral-500 bg-neutral-900/30 backdrop-blur-sm text-neutral-300',
      'ring-1 ring-inset ring-neutral-300/10',
      'cursor-pointer outline-none transition-colors duration-300',
      'focus-visible:border-primary-500 data-[state=open]:border-primary-500 data-[state=open]:text-primary-500',
      'data-[placeholder]:text-neutral-400',
      'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <Typography
      variant={size === 'small' ? 'caption' : 'button'}
      component="span"
      className="text-inherit"
    >
      <RS.Value placeholder={placeholder} />
    </Typography>
    <RS.Icon asChild>
      <ChevronDownIcon
        width={size === 'small' ? 12 : 16}
        height={size === 'small' ? 12 : 16}
        className="transition-transform duration-300 group-data-[state=open]:rotate-180"
      />
    </RS.Icon>
  </RS.Trigger>
);

export interface SelectContentProps
  extends React.ComponentProps<typeof RS.Content> {
  label?: string;
  animated?: boolean;
  /** Element to portal the menu into (defaults to document.body). */
  container?: HTMLElement | null;
}

export const SelectContent: React.FC<SelectContentProps> = ({
  label,
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
    <RS.Portal container={container}>
      <RS.Content
        {...props}
        ref={contentRef}
        position="popper"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={extendedTwMerge(
          menuContentClassName,
          'min-w-[var(--radix-select-trigger-width)]',
          'max-h-[var(--radix-select-content-available-height)]',
          className,
        )}
      >
        <MenuPanel label={label}>
          <RS.Viewport className="flex-1">{children}</RS.Viewport>
        </MenuPanel>
      </RS.Content>
    </RS.Portal>
  );
};

export interface SelectItemProps extends React.ComponentProps<typeof RS.Item> {
  icon?: React.ElementType;
}

export const SelectItem: React.FC<SelectItemProps> = ({
  icon: Icon,
  value,
  className,
  children,
  ref,
  ...props
}) => {
  const { register, unregister } = useContext(SelectCtx);
  const registered = useRef<HTMLElement | null>(null);
  const itemRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) {
        registered.current = el;
        register(value, el);
      } else if (registered.current) {
        unregister(value, registered.current);
        registered.current = null;
      }
    },
    [register, unregister, value],
  );

  const composedItemRef = useComposedRefs(itemRef, ref);

  return (
    <RS.Item
      {...props}
      ref={composedItemRef}
      value={value}
      className={extendedTwMerge(menuItemClassName, className)}
    >
      {Icon && <Icon width={20} height={20} />}
      <MenuItemLabel>
        <RS.ItemText>{children}</RS.ItemText>
      </MenuItemLabel>
      <RS.ItemIndicator>
        <CheckIcon width={16} height={16} />
      </RS.ItemIndicator>
    </RS.Item>
  );
};
