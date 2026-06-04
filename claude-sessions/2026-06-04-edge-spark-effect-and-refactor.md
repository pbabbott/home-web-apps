# 2026-06-04 — Edge Spark Effect & Edge Hierarchy Refactor

## Summary

Built an animated spark effect for ReactFlow edges (inspired by the hex background spark), extracted it into a shared component, refactored the edge component hierarchy to match the BaseNode pattern, and wired up diagram-maker sidebar support.

---

## Work Done

### 1. `DefaultEdge` — Animated Spark Effect (`data.active`)

- Added `active?: boolean` prop (via `data.active`) to `DefaultEdge`
- Spark renders when `active === true`, toggled via Storybook story
- Iterated through several approaches:
  - SVG SMIL `<animate>` inside `<path>` — invisible (likely sub-pixel dasharray or React SMIL wiring issue)
  - Switched to **CSS `@keyframes` animation** + `useLayoutEffect` + `ref.getTotalLength()` for real pixel values — resolved visibility
  - Replaced 4 uniform-opacity circles with **chunked stroke segments** for gradient fade (tail→head opacity ramp)

### 2. `EdgeSparkEffect` — Extracted Shared Component

**`packages/fui-components/src/components/EdgeSparkEffect/EdgeSparkEffect.tsx`** (new)

Key design:
- `makeRamp(count, min, max, power=2.5)` — power-curve generator for opacity and size arrays
- `NUM_CHUNKS = 32` segments, each animated via CSS with staggered `animation-delay`
- Two stroke layers per chunk: wide glow (`primary[700]`) + narrow core (`primary[400]`)
- Head circle (`primary[200]`) with SVG `animateMotion` + glow filter
- Hidden `<path ref>` for `getTotalLength()` measurement

Tuning constants (all at top of file):
| Constant | Default | Controls |
|---|---|---|
| `NUM_CHUNKS` | 32 | Smoothness of gradient |
| `TRAIL_FRACTION` | 0.4 | How much of path is lit |
| `CHUNK_SPACING` | 0.005 | Gap between segments |
| `SPARK_DURATION` | 1.3s | Speed |
| `GLOW_WIDTHS` | 3→4px | Outer halo taper |
| `CORE_WIDTHS` | 1→1.75px | Core line taper |

### 3. Edge Component Hierarchy Refactor

Matched the `BaseNode` / `DefaultNode` pattern:

**Before:**
- `DefaultEdge` — simple edge + spark
- `EditableEdge` — label editing + spark

**After:**
- `BaseEdge/BaseEdge.tsx` — full implementation (label editing + spark), `editable?: boolean` prop
  - `editable=true` (default): renders `EdgeLabelRenderer` + `EdgeLabelContent`
  - `editable=false`: no label UI
  - Aliases xyflow's `BaseEdge` as `XyBaseEdge` to avoid name collision
- `DefaultEdge` → `<BaseEdge {...props} editable={false} />`
- `EditableEdge` → `<BaseEdge {...props} />`
- `BaseEdge` + `BaseEdgeProps` exported from `src/index.ts`

### 4. diagram-maker Sidebar — Edge Active Toggle

**`DiagramEditorContext.tsx`:**
- `selectedEdgeActive: boolean | undefined` derived from `data.active` of first selected edge
- `onEdgeActiveChange(active)` — sets `data.active` + `zIndex: 20` (active) or `0` (inactive)

**`EdgeActiveControl.tsx`** (new sidebar control):
- Checkbox labeled "Spark Effect / Active"
- Disabled when no edge selected

**`Sidebar.tsx`:** `<EdgeActiveControl />` added after `<EdgeLabelColorControl />`

### 5. fui-icons — Paper Plane Icon

Added `radix-paper-plane` to `ICON_REGISTRY`:
- `slug: 'PaperPlaneIcon'` (from `@radix-ui/react-icons`)
- Keywords: `send`, `message`, `email`, `submit`, `deploy`

---

## Files Changed

```
packages/fui-components/src/components/
  BaseEdge/BaseEdge.tsx                    (new — full edge implementation)
  EdgeSparkEffect/EdgeSparkEffect.tsx      (new — spark animation component)
  DefaultEdge/DefaultEdge.tsx              (rewritten — thin wrapper)
  DefaultEdge/DefaultEdge.stories.tsx      (updated — active story, zIndex)
  EditableEdge/EditableEdge.tsx            (rewritten — thin wrapper)
  diagramShared.ts                         (unchanged — DefaultEdge/EditableEdge still registered)
  src/index.ts                             (added BaseEdge export)

apps/diagram-maker/src/app/components/
  DiagramEditorContext.tsx                 (selectedEdgeActive + onEdgeActiveChange)
  Sidebar/EdgeProps/EdgeActiveControl.tsx  (new)
  Sidebar/Sidebar.tsx                      (EdgeActiveControl added)

packages/fui-icons/src/registry.ts        (radix-paper-plane added)
```
