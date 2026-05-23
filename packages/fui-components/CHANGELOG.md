# fui-components

## 0.6.0

### Minor Changes

- Add Directory dropdown navigation with new pages and extended DropdownMenuItem
  - StickyHeader: toggle CardStackPlusIcon/CardStackMinusIcon based on dropdown open state
  - StickyHeader: Series item (SectionIcon) navigates to /series page
  - StickyHeader: System Architecture item (LayersIcon) navigates to /system-architecture page
  - StickyHeader: FUI Components item navigates to fui-components.abbottland.io in new tab with OpenInNewWindowIcon
  - DropdownMenuItem: add rightIcon prop for right-side icon slot
  - Add /series and /system-architecture placeholder pages
  - Set bg-neutral-800 as default site background

## 0.5.0

### Minor Changes

- Button: add `component` prop for polymorphic rendering (e.g. Next.js Link), `href` prop, and `no-underline` base class
- Button: add AsLink story and snapshot
- HexagonButton: disable shimmer and travel-ring animations when `prefers-reduced-motion: reduce` is set
- HexagonalBackground: disable spark canvas animation when `prefers-reduced-motion: reduce` is set
- Playwright: `gotoStory` now emits `reducedMotion: 'reduce'` for deterministic snapshots
- Add new baseline snapshots for HexagonButton, HexagonalBackground, Table, TiledHexagons

## 0.4.4

### Patch Changes

- Fix production TypeErrors caused by fui-components dist built with jsxDEV (development JSX runtime). Lock build:npm to NODE_ENV=production so Vite always emits jsx/jsxs instead of jsxDEV.

## 0.4.3

### Patch Changes

- Reduce docker build to just be nginx

## 0.4.2

### Patch Changes

- Modify storybook build to use version tag rather than latest

## 0.4.1

### Patch Changes

- Issuing new version with docker ignore changes

## 0.4.0

### Minor Changes

- Initial release of the newly refactors component lib

## 0.1.0

### Minor Changes

- Upgrade storybook to v10 and integrate with new blog site
