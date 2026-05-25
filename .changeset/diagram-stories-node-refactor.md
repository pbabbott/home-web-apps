---
'@abbottland/fui-components': minor
'@abbottland/diagram-maker': minor
'@abbottland/blog': minor
---

## @abbottland/fui-components

### New Components & Stories

- Add `DiagramViewer` component with fullscreen support and read-only ReactFlow canvas
- Add Storybook stories and Playwright visual regression tests for `DefaultEdge`, `DefaultNode`, `LabeledNode`, `TextNode`, and `DiagramViewer`
- Add `DiagramViewerShowcase` stories using real diagram presets

### Refactors

- Move `DefaultNode` and `LabeledNode` from `DiagramViewer/nodes/` into canonical `src/components/` directories; update `index.ts` exports
- Replace the separate read-only `DiagramViewer/nodes/TextNode` with the shared `TextNode` — add `data.readonly` prop to disable double-click editing; `DiagramViewer` now injects `readonly: true` into all node data
- Extract `EditableEdge` label rendering into `EdgeLabelContent` and `EdgeLabelInput` subcomponents

### Bug Fixes

- Fix `HexagonButton` hover state stuck on touch devices — replace `onMouseEnter`/`onMouseLeave` with `onPointerEnter`/`onPointerLeave`

### Test Infrastructure

- Limit local Playwright workers to 2 and raise `expect.timeout` to 15 s to reduce snapshot generation failures on low-resource machines
- Add `diagrams` story category to the Playwright test generator; auto-run `format:fix` after generation

## @abbottland/diagram-maker

- Add node type control and refactor header panels
- Merge import/export into tabbed modal with diagram presets
- Extract diagram editor into context + split components; add viewer toggle
- Reorganize sidebar with node previews and consolidated edge type options

## @abbottland/blog

- Add Directory dropdown nav with Series and System Architecture pages
- Add footer section, refine welcome copy, fix button links
- Restore homepage animations broken by hardcoded `false`
- Add pausable terminal with sequenced landing section reveals
- Responsive layout fixes and landing section animation improvements
