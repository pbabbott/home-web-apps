# 2026-05-18 — Blog Homepage Responsive Design & Animations Context

## Summary

Focused on responsive layout fixes for the blog homepage and adding an animations context system.

## Changes

### Responsive Layout Fixes

- `WelcomeSection`: fixed `grid-cols-2` → `grid-cols-1 md:grid-cols-2` so panels stack on small screens
- `AboutMeSection`: same grid fix; added `min-h-64` to `Panel` so fill image has height when stacked
- `WelcomeSection`: added `min-h-[calc(100vh-var(--header-height))]` + `justify-center` for viewport-height section
- `LandingSection`: simplified layout to `flex-col gap-6` top-down, removed `min-h-[50vh]` / `flex-1` intricate spacing; responsive top padding `pt-12 md:pt-32`

### Typography Scaling

- Replaced JS `isXSScreen` state + resize listener in `LandingSection` with CSS `clamp()` on the h1
- `LandingSectionTitle` h1: `text-[clamp(1.5rem,7vw,3.5rem)]` — scales down on small screens
- `WelcomeSection` h2: `text-[clamp(1.5rem,5.5vw,2.125rem)]` — capped at h2 natural size (2.125rem / 34px)
- Both clamps have comments explaining min/max values

### Component Extraction & Consolidation

- Extracted `PanelImage` component (Panel + fill Image) from `AboutMeSection` → `src/components/PanelImage/`
- Moved all components from `src/app/components/` → `src/components/` (single source of truth)
- Each component now has its own folder; updated all import paths

### Animations Context

- Created `Home.Context.tsx` — `HomeContextProvider` with `animationsEnabled: boolean` (currently `false`)
- Wrapped home `page.tsx` in `HomeContextProvider`
- `MaskReveal`: added `animated` prop — when false, skips clip-path and RAF animation entirely
- `HexagonalBackground`: added `sparksEnabled` prop threaded into `useSparkCanvas`; disabled = canvas cleared, no RAF loop
- `ProgressiveTerminal`: added `animated` prop — when false, initializes with all lines rendered and `currentIndex = lines.length` (final state immediately); content bottom-anchored with `overflow-hidden` + `flex flex-col justify-end`
- All animation props wired through `LandingSection` via `useHomeContext()`

## Commits

- `feat(blog): responsive layout fixes and component consolidation`
- `feat(blog): add animations context and landing section improvements`
