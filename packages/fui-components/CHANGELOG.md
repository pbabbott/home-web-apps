# fui-components

## 0.7.0

### Minor Changes

- d38f169: ## @abbottland/fui-components

  ### New Components & Stories
  - Add `DiagramViewer` component with fullscreen support and read-only ReactFlow canvas
  - Add Storybook stories and Playwright visual regression tests for `DefaultEdge`, `DefaultNode`, `LabeledNode`, `TextNode`, and `DiagramViewer`
  - Add `DiagramViewerShowcase` stories using real diagram presets
  - Add `EditableEdge` stories for interactive states (`NewEdge`, `NewEdgePrimaryColor`, `Editing`, `DefaultColor`) using ReactFlow directly — `DiagramViewer` forces `readonly: true` on edges which hides placeholder text
  - Export `EditableEdgeColor` type from public API

  ### Refactors
  - Move `DefaultNode` and `LabeledNode` from `DiagramViewer/nodes/` into canonical `src/components/` directories; update `index.ts` exports
  - Replace the separate read-only `DiagramViewer/nodes/TextNode` with the shared `TextNode` — add `data.readonly` prop to disable double-click editing; `DiagramViewer` now injects `readonly: true` into all node data
  - Extract `EditableEdge` label rendering into `EdgeLabelContent` and `EdgeLabelInput` subcomponents
  - Add `editingWrapper` color field to `EdgeLabelContent` so the editing div uses color-appropriate border and background

  ### Bug Fixes
  - Fix `HexagonButton` hover state stuck on touch devices — replace `onMouseEnter`/`onMouseLeave` with `onPointerEnter`/`onPointerLeave`
  - Fix build type errors; skip DTS generation in Storybook mode

  ### Test Infrastructure
  - Limit local Playwright workers to 2 and raise `expect.timeout` to 15 s to reduce snapshot generation failures on low-resource machines
  - Add `diagrams` story category to the Playwright test generator; fix `format:fix` to run from workspace root (`pnpm -w format:fix`)

  ## @abbottland/fui-icons
  - New package: `@abbottland/fui-icons` — simple-icons backed icon library with lazy loading per icon
  - Icon registry with 290+ technology icons sourced from `simple-icons`
  - `useIconSearch` hook for filtering icons by name
  - Provider-agnostic `IconRenderer` interface consumed by `fui-components` and `diagram-maker`

  ## @abbottland/diagram-maker
  - Add node type control and refactor header panels
  - Merge import/export into tabbed modal with diagram presets
  - Extract diagram editor into context + split components; add viewer toggle
  - Reorganize sidebar with node previews and consolidated edge type options
  - Add icon picker control in sidebar using `@abbottland/fui-icons`
  - Add `EdgeLabelColorControl` to sidebar for changing editable edge label color (primary, secondary, default)

  ## @abbottland/blog
  - Add Directory dropdown nav with Series and System Architecture pages
  - Add footer section, refine welcome copy, fix button links
  - Restore homepage animations broken by hardcoded `false`
  - Add pausable terminal with sequenced landing section reveals
  - Responsive layout fixes and landing section animation improvements

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
