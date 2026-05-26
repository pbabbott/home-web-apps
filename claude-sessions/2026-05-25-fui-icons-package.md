# 2026-05-25 — fui-icons package

## What we built

New workspace package `packages/fui-icons` (`@abbottland/fui-icons`) plus full integration into `apps/diagram-maker` and `apps/blog`.

## Motivation

`apps/diagram-maker/plan.md` had a half-baked architecture sketch for icon support. Needed a concrete implementation: stable icon IDs in diagram JSON, icon-provider-agnostic shared library, lazy loading, and a picker UI in the diagram editor sidebar.

## Architecture decisions

- **`fui-components` stays icon-agnostic** — defines `IconRenderer` type and `IconRendererContext` only; no dependency on any icon source
- **React Context for propagation** — `IconRendererProvider` wraps `DiagramViewer`/`DiagramEditorClient`; `BaseNode` reads via `useIconRenderer()` hook; avoids ReactFlow node-prop hacks
- **Lazy load via `import('simple-icons')`** — entire module loaded once on first use, slug-indexed in a `Map`; deferred until a diagram with icons is rendered; simple-icons externalized in fui-icons build so Next.js handles chunking
- **`currentColor` default, brand color opt-in** — `colored: true` used for node icons (dark backgrounds make brand hex recognizable)
- **Scope v1: diagram nodes only** — existing `@radix-ui/react-icons` UI chrome untouched

## Files changed / created

### New: `packages/fui-icons/`

- `src/types.ts` — `IconProps`, `IconRenderer`, `FuiIconDefinition`
- `src/registry.ts` — 50-entry curated catalog (docker, kubernetes, react, postgres, nginx, grafana, etc.) with slug/keywords metadata
- `src/loaders.ts` — lazy-loads simple-icons module, builds `Map<slug, SimpleIcon>` once, caches per-slug promises
- `src/Icon.tsx` — React 19 `use()` + Suspense SVG renderer (brand hex or currentColor)
- `src/renderSimpleIcon.tsx` — `IconRenderer` impl apps pass to DiagramViewer
- `src/useIconSearch.ts` — hook to filter registry by id/label/keywords
- `src/index.ts` — barrel
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`

### Modified: `packages/fui-components/`

- `src/types/icons.ts` — NEW: `IconRenderer`/`IconProps` types (agnostic contract)
- `src/components/DiagramViewer/IconRendererContext.tsx` — NEW: context + `IconRendererProvider` + `useIconRenderer`
- `src/components/BaseNode/BaseNode.tsx` — added `iconId?: string` to `BaseNodeData`; renders icon top-right (20px, brand colored) via context
- `src/components/DiagramViewer/DiagramViewer.tsx` — added `renderIcon?: IconRenderer` prop; wraps render tree with `IconRendererProvider`
- `src/index.ts` — re-exports `IconRenderer`, `IconProps`, `IconRendererProvider`, `useIconRenderer`

### Modified: `apps/diagram-maker/`

- `package.json` — added `@abbottland/fui-icons: workspace:*`
- `DiagramEditorContext.tsx` — added `selectedIconId: string | undefined` + `onIconChange` to context (mirrors colorScheme pattern)
- `DiagramEditorClient.tsx` — wraps with `IconRendererProvider`; passes `renderSimpleIcon` to `DiagramViewer` in viewer mode
- `Sidebar/NodeProps/IconControl.tsx` — NEW: searchable icon picker (search input + 5-col grid, click-to-select/deselect)
- `Sidebar/Sidebar.tsx` — mounts `IconControl` between NodeType and ColorScheme controls

### Modified: `apps/blog/`

- `package.json` — added `@abbottland/fui-icons: workspace:*`
- `src/components/diagram/index.tsx` — replaced 1-line re-export with thin wrapper that injects `renderSimpleIcon` into every MDX diagram

### Modified: `turbo.json`

- Added `@abbottland/fui-icons#build:npm` task
- Added `@abbottland/diagram-maker#build` task with `dependsOn` for both fui-components and fui-icons builds
- Added fui-icons to `@abbottland/blog#build` dependsOn

## JSON format

Icon stored as optional field on node data:

```json
{
  "id": "node_1",
  "type": "labeled",
  "data": { "label": "API Gateway", "iconId": "docker" }
}
```

No serializer changes — `data` is passed verbatim through import/export already.

## Verification status

- `pnpm --filter @abbottland/fui-icons build:npm` ✅
- `pnpm --filter @abbottland/fui-components build:npm` ✅
- `pnpm --filter @abbottland/diagram-maker exec tsc --noEmit` ✅
- `pnpm --filter @abbottland/blog exec tsc --noEmit` ✅
- `pnpm --filter @abbottland/fui-icons lint` ✅
- `pnpm --filter @abbottland/fui-components lint` ✅
- `pnpm --filter @abbottland/diagram-maker lint` ✅
- `pnpm --filter @abbottland/blog lint` ✅ (1 pre-existing warning in MaskReveal.tsx)

## Deferred / out of scope

- Storybook for fui-icons
- Migrating `@radix-ui/react-icons` UI chrome to fui-icons
- `registerIcons()` runtime extension API
- Drag-from-sidebar icon palette
