# 2026-05-24 — Diagram Maker Sidebar & Nodes Refactor

## What we worked on

### Header — ExportPanel / modal separation

- Extracted modal state (`showModal`) out of `ExportPanel` into `Header`
- `ExportPanel` is now button-only (takes `onClick`, `onLoadPreset`, `nodeCount`, `edgeCount`)
- `ImportExportModal` rendered as sibling in `Header`, not nested inside button component
- Added **Load Preset** button (`accent-falcon outlined`) that opens modal directly on the Presets tab
- Exported `Tab` type from `ImportExportModal` so `Header` can type `modalTab: Tab | null`

### Node components — moved to fui-components

- `DefaultNode` and `LabeledNode` (thin `BaseNode` wrappers) exported from `fui-components` index (sourced from `DiagramViewer/nodes/`)
- Created editable `TextNode` at `packages/fui-components/src/components/TextNode/TextNode.tsx` (double-click inline edit, `useReactFlow` to persist content)
- Deleted `apps/diagram-maker/src/app/components/nodes/` entirely
- `DiagramEditor.tsx` now imports all three node types from `@abbottland/fui-components`

### Sidebar — NodeTypeControl

- Added `selectedNodeType` + `onNodeTypeChange` to `DiagramEditorContext`
- New `NodeTypeControl` dropdown: switch selected nodes between Default / Labeled / Text
- Seeds `label` field when switching to labeled type

### Sidebar — NodesSection node previews

- Replaced `Card`-based node palette with `NodePreview` static preview components
- `NodePreview` visually matches actual node styles (same `bg-neutral-800 border-2 border-neutral-600` CSS, `150×80px`, labeled chip for labeled type, plain text for text type)
- Default node shows "Default Node" placeholder text centered

### Edge type constants

- `edgeTypeOptions` moved from `EdgeTypeControl` local const → `constants.ts`
- Renamed "Editable" → "Labeled"; Basic (`'default'`) is now first/default
- Default edge fallback updated in context and control from `'editable'` → `'default'`

### Sidebar file reorganization

- Controls moved into subdirectories: `NodeProps/` (ColorSchemeControl, HandlesControl, LayerControls, NodeTypeControl) and `EdgeProps/` (EdgeTypeControl)
- `NodesSection` + `NodePreview` live in `Nodes/`

## Commits

- `a5ef09e` feat: add node type control and refactor header panels
- `890a0b0` refactor: move node components to fui-components
- `5d27897` refactor: reorganize sidebar, add node previews, consolidate edge type options
