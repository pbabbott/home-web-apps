# 2026-05-23 — DropdownMenu Component + Blog Header Integration

## Summary

Built a new `DropdownMenu` component in `packages/fui-components` and wired it into both Storybook showcases and the blog's `StickyHeader`.

---

## fui-components changes

### Storybook upgrade

- Bumped all `@storybook/*` packages from `^10.0.x` to `^10.4.0` (resolved to `10.4.1`)

### New: `DropdownMenu` component (`src/components/DropdownMenu/`)

- **`DropdownMenu.tsx`** — wraps `@radix-ui/react-dropdown-menu` (first Radix primitive beyond icons in this package)
  - `DropdownMenu` = `RDM.Root`
  - `DropdownMenuTrigger` = `RDM.Trigger`
  - `DropdownMenuContent` — styled panel: `bg-neutral-900/30 backdrop-blur-sm`, cyan border, centered label header with X close, L-bracket corner accents (top-left, bottom-left, bottom-right), dotted decoration column on right
  - `DropdownMenuItem` — icon + `Typography variant="button"` label, `data-[highlighted]:bg-primary-500 text-neutral-900` hover state
- **`DottedDecoration.tsx`** — private SVG helper: 3×6 fading dot grid + 3 bullet points, `currentColor`-driven
- **`DropdownMenu.stories.tsx`** — `Components/DropdownMenu` story with controlled open state

### New: `MaskReveal` component (`src/components/MaskReveal/`)

- Promoted from `apps/blog/src/components/MaskReveal/MaskReveal.tsx`
- Removed `'use client'` directive, changed to named export
- Added diagonal directions: `'top-right-to-bottom-left'` and `'top-left-to-bottom-right'`
  - Implemented via per-frame `clip-path: polygon()` computation (two-phase: triangle → full rect)
  - Axis directions still use `clip-path: inset()` as before

### `DropdownMenu` reveal animation

- Diagonal `top-right-to-bottom-left` wipe on open, 600ms, no delay
- Applied directly to `RDM.Content` DOM element via `useCallback` ref (wrapper div can't clip Radix's positioned element)
- Guard: `__animated` flag on the DOM element itself — prevents hover re-calls from restarting animation while still re-animating on each new open (Radix creates fresh DOM element per open)

### NavItem change

- `active` prop color changed from `text-primary-700` → `text-primary-500` to match hover color

### Shared story fixture

- `src/stories/shared/DirectoryMenuItems.tsx` — extracted repeated menu items (FUI Components / Series / System Architecture) used by both `DropdownMenu.stories.tsx` and `NavbarShowcase.stories.tsx`

### NavbarShowcase update

- `InsideFixedHeader` story wires `Directory` NavItem as `DropdownMenuTrigger`
- Controlled open state: `active={open}` on NavItem illuminates it when dropdown is open
- Dropdown uses `align="end"` to anchor to right edge

### Exports

- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `MaskReveal` all added to `src/index.ts`
- Added `@radix-ui/react-dropdown-menu: ^2.1.16` to dependencies

---

## apps/blog changes

### `StickyHeader.tsx`

- Added `Directory` nav item with full `DropdownMenu` integration
- Controlled open state, `active={open}` on NavItem
- Same three items as Storybook (FUI Components / Series / System Architecture)
- Label: "Interface Directory"

---

## Key design decisions

| Decision                                                         | Reason                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `clip-path` animation on `RDM.Content` directly via callback ref | Wrapper div can't clip Radix's `position: absolute` content                                      |
| `__animated` flag on DOM element (not React state/ref)           | Distinguishes hover re-calls (same element) from new opens (fresh element)                       |
| `useCallback(fn, [])` not `useEffect([], [])`                    | `DropdownMenuContent` is always mounted; effect fires before `RDM.Content` exists in DOM         |
| Diagonal polygon computed per-frame from scalar `t`              | `clip-path: inset()` can't do diagonal; animejs doesn't interpolate polygon strings              |
| `text-inherit` on Typography inside DropdownMenuItem             | Typography hardcodes `text-neutral-50`; inherit lets parent's `data-[highlighted]` color cascade |
