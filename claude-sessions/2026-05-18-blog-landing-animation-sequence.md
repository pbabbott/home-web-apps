# 2026-05-18 — Blog Landing Section Animation Sequence

## Summary

Built a fully sequenced, pause-driven animation system for the landing section. The `ProgressiveTerminal` now gates page reveals — each terminal line can pause the terminal, trigger an animation, and resume only when the animation completes.

## Changes

### `pt-[calc(var(--header-height)+1rem)]`

- Replaced `pt-12 md:pt-32` on the landing content container with a CSS calc using `--header-height` so content always clears the header exactly.

### `onAfterText` hook on `TerminalLine`

- Added `onAfterText?: () => void` to `TerminalLine` interface.
- Fires after text finishes typing, before `endOfLineComponent` renders.
- Used as the integration point for triggering page-level reveals.

### `MaskReveal` — `onComplete` prop

- Added `onComplete?: () => void` prop, called from the existing anime.js `complete` callback.
- Not called when `animated=false`.
- Added `onComplete` to the effect dep array (guarded by `hasStartedRef`).

### `LandingSection.Context` — pause/resume + named reveal actions

- Added `isTerminalPaused: boolean` state.
- Added `pauseTerminal()` / `resumeTerminal()` (simple boolean, not a counter).
- Added named reveal actions: `startTitleReveal()`, `startControlDevicesReveal()`, `startBackgroundReveal()`.
- Removed old `onTerminalEventStarted` dispatch logic (title/background triggers moved to `onAfterText`).

### `LandingSectionTitle` — split into two `MaskReveal`s

- Title (h1 + h5) in first `MaskReveal` with `reveal` / `onComplete` props; `delay={0}`, `duration={1500}`.
- Buttons (Read Manual, Read Blog) in second `MaskReveal` with `revealButtons` / `onButtonsComplete` props; `delay={0}`, `duration={800}`.
- Outer `<div>` preserves the `flex-col items-center` layout.

### `LandingSection` — wired all three `onComplete={resumeTerminal}`

- Background `MaskReveal`: `onComplete={resumeTerminal}`, `delay={0}` (was 2000).
- `LandingSectionTitle`: `onComplete={resumeTerminal}`, `revealButtons={showControlDevices}`, `onButtonsComplete={resumeTerminal}`.

### `ProgressiveTerminal` — useReducer refactor + pause gate

- Replaced 4× `useState` with `useReducer` (`TerminalState` / `TerminalAction`).
  - `LINE_TYPED`: stores `pendingCompletion` (line + eventName), does NOT yet add to `renderedLines`.
  - `FLUSH`: moves pending line into `renderedLines`, shows `endOfLineComponent`, advances `currentIndex`.
- `lines` array moved into `useMemo` so `onAfterText` callbacks close over context actions.
- `useEffect` on `[isTerminalPaused, state.pendingCompletion]`: dispatches `FLUSH` + fires `onTerminalEventFinished` only when not paused.
- Fixes the "line appears before event is done" bug: `renderedLines` only grows on `FLUSH`, not on text complete.
- Fixes `react-hooks/set-state-in-effect` lint error: effect calls `dispatch` (single update) + external callback, not multiple `setState`.

### Sequence wired (in order)

1. "Welcoming user to website..." → DONE (no pause)
2. "Initializing website title..." → `startTitleReveal()` + pause → h1+h5 wipe (1500ms) → DONE
3. "Rendering human-required control devices..." → `startControlDevicesReveal()` + pause → buttons wipe (800ms) → DONE
4. "Generating non-essential visual layer..." → `startBackgroundReveal()` + pause → hexagonal bg wipe (2000ms) → DONE
5. "Awaiting user action..." → no pause
6. "..." (IDLE)
7. "... ... ..." (PROCESS_DELAYED)
8. "User action pending..." → HUMAN LATENCY DETECTED
9. "..." (second IDLE)
10. "Click a button above to continue"
11. "or scroll down the page."

### `TerminalEvent` enum additions/renames

- Added: `RENDERING_CONTROL_DEVICES`, `GENERATING_NON_ESSENTIAL_VISUAL_LAYER`, `IDLE`, `TIME_ELAPSED_EXCEEDS_EXPECTATION`
- Removed: `RENDERING_BACKGROUND_EXPERIENCE`, `STILL_WAITING_FOR_USER_ACTION`

### `Home.Context` — animations enabled

- Flipped `animationsEnabled` from `false` → `true`.

## Commits

- `feat(blog): add pausable terminal with sequenced landing section reveals` (amended)
