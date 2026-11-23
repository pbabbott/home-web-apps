import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import {
  CheckIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';
import { Scrollbar } from '../Scrollbar/Scrollbar';
import {
  MenuItemLabel,
  MenuPanel,
  flashItem,
  menuContentClassName,
  useClipReveal,
  useComposedRefs,
} from '../DropdownMenu/menuShared';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Options sharing a group are listed together under a heading. */
  group?: string;
  disabled?: boolean;
  /** Extra searchable text (label and group are always searchable). */
  keywords?: string[];
}

export type ComboboxSize = 'default' | 'small';

export interface ComboboxProps {
  options: ComboboxOption[];
  /** Selected option value. Controlled if the prop is passed at all (`null` = nothing selected). */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /**
   * Adds a first row (e.g. "Any payee") that selects `null`. It is also shown
   * on the trigger while nothing is selected.
   */
  clearLabel?: string;
  /** Heading shown at the top of the popover. */
  label?: string;
  size?: ComboboxSize;
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Play the diagonal reveal when opening. */
  animated?: boolean;
  /** Element to portal the popover into (defaults to document.body). */
  container?: HTMLElement | null;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

interface ScrollMetrics {
  height: number;
  size: number;
  position: number;
}

const TICK_SPACING = 18;

/**
 * Mirrors a native scroll container into Scrollbar props. Re-measures on
 * scroll and whenever the element or its content changes size (filtering).
 */
const useScrollMetrics = () => {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    height: 0,
    size: 1,
    position: 0,
  });

  const sync = useCallback(() => {
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const size =
      scrollHeight > 0 ? Math.min(clientHeight / scrollHeight, 1) : 1;
    const scrollable = scrollHeight - clientHeight;
    const progress = scrollable > 0 ? scrollTop / scrollable : 0;
    setMetrics((prev) => {
      const next = {
        height: clientHeight,
        size,
        position: progress * (1 - size),
      };
      return prev.height === next.height &&
        prev.size === next.size &&
        prev.position === next.position
        ? prev
        : next;
    });
  }, [el]);

  useEffect(() => {
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    // cmdk wraps the items in a sizer div whose height tracks the content.
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [el, sync]);

  const scrollToThumb = useCallback(
    (thumbPosition: number) => {
      if (!el) return;
      const size = metrics.size;
      const scrollable = el.scrollHeight - el.clientHeight;
      if (size >= 1 || scrollable <= 0) return;
      el.scrollTop = (thumbPosition / (1 - size)) * scrollable;
    },
    [el, metrics.size],
  );

  const pageStep = useCallback(
    (direction: 'up' | 'down') => {
      el?.scrollBy({
        top: direction === 'up' ? -el.clientHeight : el.clientHeight,
      });
    },
    [el],
  );

  return { setEl, metrics, scrollToThumb, pageStep };
};

const CLEAR_VALUE = '__combobox_clear__';

const triggerSizeClasses: Record<ComboboxSize, string> = {
  default: 'px-3 py-2 gap-3',
  small: 'px-2.5 py-1 gap-2',
};

const itemClassName = extendedTwMerge(
  'flex items-center gap-3 px-3 py-2 text-neutral-300',
  'cursor-pointer outline-none transition-colors duration-200',
  'data-[selected=true]:bg-primary-500 data-[selected=true]:text-neutral-900',
  'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40',
);

/**
 * Every search token must appear in the option's label/group/keywords
 * (case-insensitive). Earlier matches rank higher. The option `value` (often
 * an opaque id) is deliberately not searched.
 */
const filter = (_value: string, search: string, keywords?: string[]) => {
  const haystack = (keywords ?? []).join(' ').toLowerCase();
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 1;
  for (const token of tokens) {
    const at = haystack.indexOf(token);
    if (at === -1) return 0;
    score = Math.min(score, 1 / (1 + at));
  }
  return Math.max(score, 0.001);
};

/**
 * Searchable single-select: a Radix Popover holding a cmdk list, styled like
 * Select/DropdownMenu. Type to filter, arrows + Enter to pick, Esc to close.
 */
export const Combobox: React.FC<ComboboxProps> = (allProps) => {
  const {
    options,
    value: valueProp,
    defaultValue = null,
    onValueChange,
    placeholder,
    searchPlaceholder = 'Search…',
    emptyText = 'No matches',
    clearLabel,
    label,
    size = 'default',
    disabled,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    animated = true,
    container,
    className,
    id,
    'aria-label': ariaLabel,
  } = allProps;

  const valueControlled = 'value' in allProps;
  const [valueState, setValueState] = useState<string | null>(defaultValue);
  const [openState, setOpenState] = useState(defaultOpen);
  const [search, setSearch] = useState('');
  const value = valueControlled ? (valueProp ?? null) : valueState;
  const open = openProp !== undefined ? openProp : openState;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const itemEls = useRef(new Map<string, HTMLElement>());
  const flashing = useRef(false);
  const cancelFlash = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cancelFlash.current?.();
      cancelFlash.current = null;
      flashing.current = false;
    },
    [],
  );

  const scroll = useScrollMetrics();
  const overflowing = scroll.metrics.size < 1;

  const revealRef = useClipReveal(animated);
  const contentRef = useComposedRefs(revealRef);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && flashing.current) return;
    setOpenState(next);
    if (!next) setSearch('');
    onOpenChangeRef.current?.(next);
  }, []);

  const commit = useCallback(
    (next: string | null) => {
      flashing.current = false;
      cancelFlash.current = null;
      setValueState(next);
      onValueChangeRef.current?.(next);
      handleOpenChange(false);
    },
    [handleOpenChange],
  );

  const handleSelect = useCallback(
    (itemValue: string) => {
      if (flashing.current) return;
      const next = itemValue === CLEAR_VALUE ? null : itemValue;
      const el = itemEls.current.get(itemValue);
      if (!el || !el.isConnected) {
        commit(next);
        return;
      }
      flashing.current = true;
      cancelFlash.current = flashItem(el, () => commit(next));
    },
    [commit],
  );

  const setItemEl = (itemValue: string) => (el: HTMLElement | null) => {
    if (el) itemEls.current.set(itemValue, el);
    else itemEls.current.delete(itemValue);
  };

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  // Ungrouped options first, then groups in order of first appearance.
  const { ungrouped, groups } = useMemo(() => {
    const ungrouped: ComboboxOption[] = [];
    const groups = new Map<string, ComboboxOption[]>();
    for (const o of options) {
      if (!o.group) ungrouped.push(o);
      else {
        const list = groups.get(o.group);
        if (list) list.push(o);
        else groups.set(o.group, [o]);
      }
    }
    return { ungrouped, groups: [...groups] };
  }, [options]);

  const renderOption = (o: ComboboxOption) => (
    <Command.Item
      key={o.value}
      ref={setItemEl(o.value)}
      value={o.value}
      keywords={[o.label, ...(o.group ? [o.group] : []), ...(o.keywords ?? [])]}
      disabled={o.disabled}
      onSelect={handleSelect}
      className={itemClassName}
    >
      <MenuItemLabel>{o.label}</MenuItemLabel>
      {o.value === value && <CheckIcon width={16} height={16} />}
    </Command.Item>
  );

  const triggerText =
    selected?.label ?? (value === null ? clearLabel : undefined);
  const showingPlaceholder = triggerText === undefined;

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        disabled={disabled}
        data-placeholder={showingPlaceholder ? '' : undefined}
        className={extendedTwMerge(
          'group inline-flex min-w-[200px] items-center justify-between text-left',
          triggerSizeClasses[size],
          'border border-neutral-500 bg-neutral-900/30 backdrop-blur-sm text-neutral-300',
          'ring-1 ring-inset ring-neutral-300/10',
          'cursor-pointer outline-none transition-colors duration-300',
          'focus-visible:border-primary-500 data-[state=open]:border-primary-500 data-[state=open]:text-primary-500',
          'data-[placeholder]:text-neutral-400',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )}
      >
        <Typography
          variant={size === 'small' ? 'caption' : 'button'}
          component="span"
          className="text-inherit truncate"
        >
          {showingPlaceholder ? (placeholder ?? '') : triggerText}
        </Typography>
        <ChevronDownIcon
          width={size === 'small' ? 12 : 16}
          height={size === 'small' ? 12 : 16}
          className="shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180"
        />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          ref={contentRef}
          sideOffset={8}
          collisionPadding={8}
          align="start"
          className={extendedTwMerge(
            menuContentClassName,
            'min-w-[var(--radix-popover-trigger-width)]',
            'max-h-[var(--radix-popover-content-available-height)]',
            'outline-none',
          )}
        >
          <MenuPanel label={label} hideDecoration={overflowing}>
            <Command
              filter={filter}
              loop
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <div className="flex items-center gap-2 border-b border-primary-900 px-3 py-2 text-primary-500">
                <MagnifyingGlassIcon
                  width={16}
                  height={16}
                  className="shrink-0"
                />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent font-monobit text-button tracking-[.1em] text-neutral-200 outline-none placeholder:text-neutral-500"
                />
              </div>
              <div className="flex min-h-0 gap-1">
                <Command.List
                  ref={scroll.setEl}
                  className="min-w-0 flex-1 max-h-64 overflow-y-auto overscroll-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <Command.Empty className="px-3 py-3 text-center">
                    <Typography
                      variant="caption"
                      component="span"
                      className="text-neutral-400"
                    >
                      {emptyText}
                    </Typography>
                  </Command.Empty>
                  {clearLabel && (
                    <Command.Item
                      ref={setItemEl(CLEAR_VALUE)}
                      value={CLEAR_VALUE}
                      keywords={[clearLabel]}
                      onSelect={handleSelect}
                      className={itemClassName}
                    >
                      <MenuItemLabel>{clearLabel}</MenuItemLabel>
                      {value === null && <CheckIcon width={16} height={16} />}
                    </Command.Item>
                  )}
                  {ungrouped.map(renderOption)}
                  {groups.map(([heading, list]) => (
                    <Command.Group
                      key={heading}
                      heading={
                        <Typography
                          variant="caption"
                          component="span"
                          className="block px-3 pt-2 pb-1 text-primary-500 tracking-wider"
                        >
                          {heading}
                        </Typography>
                      }
                    >
                      {list.map(renderOption)}
                    </Command.Group>
                  ))}
                </Command.List>
                {overflowing && (
                  <Scrollbar
                    className="shrink-0 self-center"
                    height={scroll.metrics.height}
                    tickCount={Math.max(
                      2,
                      Math.round(scroll.metrics.height / TICK_SPACING),
                    )}
                    thumbPosition={scroll.metrics.position}
                    thumbSize={scroll.metrics.size}
                    showDots={false}
                    onThumbPositionChange={scroll.scrollToThumb}
                    onPageStep={scroll.pageStep}
                  />
                )}
              </div>
            </Command>
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
