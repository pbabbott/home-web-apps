# Session: Table Refactor, Radix UI, Blog Scroll Wrapper

**Date:** 2026-05-27
**Branch:** develop → PR #103 → main

## What We Did

### 1. Refactored `fui-components` Table component

- Rewrote `packages/fui-components/src/components/Table/Table.tsx`
- Replaced native HTML wrappers with `@radix-ui/themes` Table sub-components (`RT.Header`, `RT.Body`, `RT.Row`, `RT.ColumnHeaderCell`, `RT.Cell`)
- Kept `Table` root as native `<table>` — `Table.Root` renders a `<div>` wrapper which breaks `border-collapse`
- Later dropped `@radix-ui/themes` entirely after determining it added no real value without importing its CSS
- Final state: native HTML elements throughout, `scope="col"` added to `Th` for a11y, redundant `className?: string` props removed

### 2. Added WideTable Storybook story

- Added `WideTable` story to `Table.stories.tsx`: 7 columns (Service, Namespace, Replicas, CPU Request, Memory Limit, Status, Last Deploy), 4 rows of k8s-flavored data
- Wrapped in `<div style={{ maxWidth: 300 }}>` to demonstrate overflow behavior
- Playwright spec auto-generated for it

### 3. ScrollableTable — blog integration

- Explored using `@radix-ui/themes` ScrollArea → requires full themes CSS + `.radix-themes` wrapper, not practical without full theme setup
- Explored `@radix-ui/react-scroll-area` primitive via `radix-ui` unified package → transitive dep, Vite couldn't resolve it
- Installed `@radix-ui/react-scroll-area` directly → then decided to unwind entirely
- Final approach: simple `overflow-x-auto` div wrapper
- Created `apps/blog/src/components/ScrollableTable/ScrollableTable.tsx`
- Wrapped both `<Table>` blocks in `apps/blog/src/content/blog/a-new-beginning-.../index.mdx` with `<ScrollableTable>`

### 4. Dependency cleanup

- Installed then removed `@radix-ui/themes` from fui-components
- Installed then removed `@radix-ui/react-scroll-area` from fui-components
- Net result: no new deps in fui-components

### 5. Versioning and PR

- Created changeset: `fui-components` minor, `blog` minor
- Applied: `fui-components` 0.7.0 → 0.8.0, `blog` 0.6.0 → 0.7.0, `diagram-maker` patch bump (transitive)
- Committed, pushed `develop`, opened PR #103 into `main`

## Key Decisions

| Decision                              | Reason                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Skip `@radix-ui/themes`               | Requires CSS + Theme provider; without it, components are unstyled wrappers with no value over native HTML |
| Keep `Table` root as native `<table>` | `Table.Root` wraps in `<div>`, breaking `border-collapse` and table border styling                         |
| Use `overflow-x-auto` div for blog    | No extra deps, works perfectly for the use case; Radix scroll area was over-engineered for a blog          |
| `scope="col"` on `Th`                 | A11y improvement, retained from the Radix `ColumnHeaderCell` the refactor originally used                  |

## Files Changed

- `packages/fui-components/src/components/Table/Table.tsx`
- `packages/fui-components/src/components/Table/Table.stories.tsx`
- `packages/fui-components/src/components/Table/__screenshots__/components-table--wide-table.png`
- `packages/fui-components/src/components/Table/Table.playwright.spec.ts`
- `packages/fui-components/package.json`
- `apps/blog/src/components/ScrollableTable/ScrollableTable.tsx` _(new)_
- `apps/blog/src/content/blog/a-new-beginning-.../index.mdx`
- `apps/blog/package.json`
