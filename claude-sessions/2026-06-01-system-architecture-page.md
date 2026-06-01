# 2026-06-01 — System Architecture Page

## Goal

Build a `/system-architecture` page on the blog that presents the site's own infrastructure using C1/C2/C3 architecture diagrams, with a terminal-voice tone consistent with the rest of the site.

## What Was Built

### New page: `/system-architecture`

- Three diagram sections: **C1 System Context**, **C2 Infrastructure Containers**, **C3 Service Components**
- Diagrams use empty `DiagramViewer` placeholders (content TBD)
- Diagram heights grow with complexity: 360px → 480px → 600px
- Background hierarchy: `neutral-950` footer → `neutral-900` page → `neutral-800` diagrams
- Terminal intro block types out 6 lines on load via `ProgressiveTerminal`

### Terminal intro lines (system-arch page)

```
Initializing self-inspection routine...     DONE
Target system:                              abbottland.io
Resolving abstraction levels...             3 LEVELS FOUND
Generating infrastructure map...            DONE
Rendering architecture powering this site...  DONE
Advising human to expect increasing complexity...  DONE
```

### Voice/tone

Terminal-system aesthetic throughout: procedural, dry, faux-diagnostic. Labels use `Typography variant="caption"` (already uppercase + tracked). Section descriptions written as system status reports.

## Refactors

### `ProgressiveTerminal` extracted to shared component

**Before:** `ProgressiveTerminal` was hardcoded inside `LandingSection/`, read `LandingSectionContext` directly for pause/resume and callbacks, had `TerminalEvent` enum baked in.

**After:** `src/components/ProgressiveTerminal/ProgressiveTerminal.tsx`
- Accepts `lines: TerminalLine[]` prop (injectable content)
- Accepts `isPaused?: boolean` prop (external pause control)
- No context dependency — pure props
- `TerminalLine` interface exported for callers

**New `LandingTerminal.tsx`** (in `LandingSection/`) wraps the shared component:
- Reads `LandingSectionContext` for `isTerminalPaused`, `pauseTerminal`, reveal callbacks
- Builds homepage-specific lines array with `onAfterText` side effects
- Passes `isPaused={isTerminalPaused}` down

**Deleted:**
- `LandingSection/ProgressiveTerminal.tsx` (replaced by shared + wrapper)
- `LandingSection/TerminalEvent.tsx` (enum was dead — callbacks were no-ops)

**Cleaned `LandingSection.Context.tsx`:** removed `onTerminalEventFinished` and `onTerminalEventStarted` (both were `() => {}` no-ops).

### `FooterSection` moved to shared component

**Before:** `src/app/(home)/FooterSection/FooterSection.tsx` — locked inside home route group.

**After:** `src/components/Footer/Footer.tsx` — used by both homepage and system-architecture page.

## Files Changed

| File | Change |
|---|---|
| `apps/blog/src/components/ProgressiveTerminal/ProgressiveTerminal.tsx` | NEW — shared terminal component |
| `apps/blog/src/components/Footer/Footer.tsx` | NEW — moved from `(home)/FooterSection` |
| `apps/blog/src/app/(home)/LandingSection/LandingTerminal.tsx` | NEW — homepage wrapper for ProgressiveTerminal |
| `apps/blog/src/app/(home)/LandingSection/ProgressiveTerminal.tsx` | DELETED |
| `apps/blog/src/app/(home)/LandingSection/TerminalEvent.tsx` | DELETED |
| `apps/blog/src/app/(home)/LandingSection/LandingSection.Context.tsx` | Removed dead event callbacks |
| `apps/blog/src/app/(home)/LandingSection/LandingSection.tsx` | Use `LandingTerminal` |
| `apps/blog/src/app/(home)/page.tsx` | Import `Footer` from shared path |
| `apps/blog/src/app/system-architecture/SystemArchitectureClient.tsx` | Full page implementation |

## Branch / PR

- Branch: `feat/system-architecture-page`
- PR: #109 (`feat/system-architecture-page` → `main`)
