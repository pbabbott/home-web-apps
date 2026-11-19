import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import * as RS from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';
import { DottedDecoration } from '../DropdownMenu/DottedDecoration';
import { LBracket, flashItem, useClipReveal } from '../DropdownMenu/menuShared';

interface SelectCtxValue {
  /** Items register their element so the root can flash it on selection. */
  register: (value: string, el: HTMLElement | null) => void;
}

const SelectCtx = createContext<SelectCtxValue>({ register: () => {} });

export interface SelectProps
  extends Omit<React.ComponentProps<typeof RS.Root>, 'open'> {
  open?: boolean;
}

/**
 * Select root. Value and open state are managed here (controlled or not) so
 * that SelectItem can play the DropdownMenu confirm flash before committing.
 */
export const Select: React.FC<SelectProps> = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}) => {
  const [valueState, setValueState] = useState(defaultValue);
  const [openState, setOpenState] = useState(defaultOpen);
  const value = valueProp !== undefined ? valueProp : valueState;
  const open = openProp !== undefined ? openProp : openState;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const itemEls = useRef(new Map<string, HTMLElement>());
  const flashing = useRef(false);

  const register = useCallback((v: string, el: HTMLElement | null) => {
    if (el) itemEls.current.set(v, el);
    else itemEls.current.delete(v);
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
      setValueState(next);
      onValueChangeRef.current?.(next);
      handleOpenChange(false);
    },
    [handleOpenChange],
  );

  // Flash-confirm the chosen item (same as DropdownMenuItem), then commit.
  const handleValueChange = useCallback(
    (next: string) => {
      const el = itemEls.current.get(next);
      if (!el) {
        commit(next);
        return;
      }
      flashing.current = true;
      flashItem(el, () => commit(next));
    },
    [commit],
  );

  return (
    <SelectCtx.Provider value={{ register }}>
      <RS.Root
        value={value}
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
  ...props
}) => {
  const contentRef = useClipReveal(animated);

  return (
    <RS.Portal container={container}>
      <RS.Content
        ref={contentRef}
        position="popper"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={extendedTwMerge(
          'relative z-50 flex min-w-[var(--radix-select-trigger-width)] flex-col bg-neutral-900/30 backdrop-blur-sm',
          'max-h-[var(--radix-select-content-available-height)]',
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
          </div>
        )}
        <div
          className={extendedTwMerge(
            'flex min-h-0 px-2 pb-1',
            // Without a label header, push items down level with the corner brackets.
            label ? 'pt-1' : 'pt-3',
          )}
        >
          <RS.Viewport className="flex-1">{children}</RS.Viewport>
          <DottedDecoration className="text-primary-700 opacity-60 self-center pr-1" />
        </div>
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
  ...props
}) => {
  const { register } = useContext(SelectCtx);
  const itemRef = useCallback(
    (el: HTMLDivElement | null) => register(value, el),
    [register, value],
  );

  return (
    <RS.Item
      ref={itemRef}
      value={value}
      className={extendedTwMerge(
        'flex items-center gap-3 px-3 py-2 text-neutral-300',
        'cursor-pointer outline-none transition-colors duration-200',
        'data-[highlighted]:bg-primary-500 data-[highlighted]:text-neutral-900',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
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
        <RS.ItemText>{children}</RS.ItemText>
      </Typography>
      <RS.ItemIndicator>
        <CheckIcon width={16} height={16} />
      </RS.ItemIndicator>
    </RS.Item>
  );
};
