# 2026-05-23 — Sticky Header Dropdown Nav

## Summary

Worked on `apps/blog` StickyHeader and its Directory dropdown menu. Added two new placeholder pages. Extended `DropdownMenuItem` in `fui-components`.

## Changes

### StickyHeader (`apps/blog/src/components/StickyHeader/StickyHeader.tsx`)

- **Toggle icon**: `CardStackPlusIcon` switches to `CardStackMinusIcon` when dropdown is open
- **Series item**: icon → `SectionIcon`, `onSelect` → `router.push('/series')`
- **System Architecture item**: icon → `LayersIcon`, `onSelect` → `router.push('/system-architecture')`
- **FUI Components item**: moved to last in list, `onSelect` → `window.open('https://fui-components.abbottland.io/', '_blank')`, added `rightIcon={OpenInNewWindowIcon}`

### DropdownMenuItem (`packages/fui-components/src/components/DropdownMenu/DropdownMenuItem.tsx`)

- Added `rightIcon?: React.ElementType` prop
- Label `Typography` gets `grow` so right icon pushes to far right
- Right icon renders at 16px with `opacity-60`

### New Pages

Both pages follow the server/client split pattern (server page exports `metadata`, client component holds JSX):

- `apps/blog/src/app/series/page.tsx` + `SeriesClient.tsx`
- `apps/blog/src/app/system-architecture/page.tsx` + `SystemArchitectureClient.tsx`

Each page has an `h1` Typography heading and a robotic under-construction body message:

> "SECTION UNAVAILABLE. Construction protocols active. Content scheduled for future deployment."

### Global Background

- `apps/blog/src/app/layout.tsx`: added `bg-neutral-800` to `<body>` — applies site-wide default background

## Files Modified

- `apps/blog/src/components/StickyHeader/StickyHeader.tsx`
- `apps/blog/src/app/layout.tsx`
- `apps/blog/src/app/globals.css`
- `packages/fui-components/src/components/DropdownMenu/DropdownMenuItem.tsx`

## Files Created

- `apps/blog/src/app/series/page.tsx`
- `apps/blog/src/app/series/SeriesClient.tsx`
- `apps/blog/src/app/system-architecture/page.tsx`
- `apps/blog/src/app/system-architecture/SystemArchitectureClient.tsx`
