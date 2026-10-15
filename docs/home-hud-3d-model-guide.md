# home-hud 3D Model Guide

How the procedural ASUSTOR NAS viewer at `/infra/viz/nas` was built, and how
to repeat the process for the next model in the homelab 3D viz collection
(~5 more planned as of this writing). Read this _before_ starting a new
model — it exists so a fresh Claude Code session with no memory of this
conversation can pick up the pattern without re-deriving it.

The NAS model is the reference implementation. When this guide says "copy
the pattern," it means copy from `src/app/infra/viz/models/nas/`.

## Mental model: two layers

```
src/app/infra/viz/
  components/     REUSABLE across every model — viewer shell, camera math,
                   hooks. A new model should rarely need to touch this dir.
  models/<slug>/   ONE model's geometry/materials/config. Nothing here
                   should leak into components/.
  <slug>/          The Next.js ROUTE for that model (page.tsx + *Client.tsx
                   + a Scene.tsx). Confusingly similar name to
                   models/<slug>/ but a different directory — see below.
```

**Naming collision to watch for**: the NAS model lives at
`models/nas/` (the model) and `src/app/infra/viz/nas/` (the route) —
two different directories both named `nas`, one nested under `models/`,
one not. This is deliberate (route slugs mirror model slugs) but easy to
open the wrong one. If the next model is e.g. a Raspberry Pi cluster,
expect `models/pi-cluster/` and `viz/pi-cluster/` as siblings, not one
directory.

### `components/` — the reusable viewer (don't touch per-model)

| File                         | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ModelViewer.tsx`            | The `<Canvas>` shell: camera, `OrbitControls` (drag/zoom/reset), idle auto-rotate, WebGL-unavailable fallback, optional lighting rig (`lit` prop) and bloom post-process (`bloom` prop). Takes the model as `children` — knows nothing about what it renders.                                                                                                                                                                                                                           |
| `EdgedMesh.tsx`              | **The core rendering primitive for the Tron line-art style.** Pairs a near-invisible solid fill (for correct hidden-line depth-sorting) with a `THREE.EdgesGeometry` → `LineSegments` outline. Every model part should render through this instead of a bare `<mesh>`.                                                                                                                                                                                                                  |
| `camera-angles.ts`           | Named camera angles (`front`/`rear`/`left`/`right`/`top`/`bottom`/`threeQuarter`) → spherical `[x,y,z]` position, parameterized by a `radius` the model supplies. Shared across all models — a new model doesn't add its own angle math.                                                                                                                                                                                                                                                |
| `useIdleRotation.ts`         | Auto-rotate that pauses on interaction and resumes after an idle delay; off under `prefers-reduced-motion`.                                                                                                                                                                                                                                                                                                                                                                             |
| `useWebGLAvailable.ts`       | One-time WebGL probe via a lazy `useState` initializer, not a `useEffect`. Since this tree only ever mounts client-side (behind `next/dynamic(..., { ssr: false })`), the probe can run during the initial render instead of needing a post-mount effect + a transient "unknown" loading state — simpler, and avoids React's `react-hooks/set-state-in-effect` lint rule (calling `setState` synchronously inside an effect body is flagged; a lazy initializer sidesteps it entirely). |
| `usePrefersReducedMotion.ts` | Live `matchMedia` tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `viewer-theme.ts`            | The _only_ place a viewer file reaches into `@abbottland/fui-components` design tokens (`neutral`, `secondary`, `accentPurple`, etc.) for the viewer chrome (background, lights). Models take plain hex strings in their own config instead — see Color Palette below.                                                                                                                                                                                                                  |
| `chamfered-box.ts`           | Builds a `THREE.ExtrudeGeometry` box with cut/beveled corners (an octagonal cross-section) instead of a plain `BoxGeometry` — reusable for any enclosure with chamfered edges (e.g. the Pironman4 case), not just plain rectangular boxes.                                                                                                                                                                                                                                              |
| `brand-texture.ts`           | Canvas-texture helper for rendering a wordmark as stroked (not filled) text — promoted here from `models/nas/` once a second model needed the same technique. Generic: any model with front-panel branding uses this, not a NAS-specific one.                                                                                                                                                                                                                                           |

### `models/<slug>/` — one model, following the NAS layout

```
models/nas/
  config.ts          ALL dimensions/layout/colors in one typed object.
                      Change a number here, not in a part file.
  materials.ts        useNasMaterials(colors) hook — builds the shared
                      THREE.Material set once, disposes on unmount.
  types.ts            Public prop shape (e.g. NasModelProps) — what a
                      future real-data caller would supply.
  status-colors.ts    Small status→color lookup (if the model has
                      selectable sub-components with state).
  REFERENCES.md        Reference-photo checklist + running log of what's
                      confirmed vs. approximated vs. corrected. See below.
  <Model>.tsx          The assembly component (e.g. AsustorNas.tsx) — the
                      ONLY place that reads config.<thing>.count and lays
                      parts out. Computes derived values once
                      (positions, widths) and passes them down as props.
  parts/
    Thing.tsx          One structural piece each. Small, reads config +
                      materials via props, renders via EdgedMesh.
```

### `<slug>/` — the Next.js route (sibling to `viz/`, not inside `models/`)

```
viz/nas/
  page.tsx            Server Component. Thin wrapper: Suspense + the
                      Client component. NO fui-components import here —
                      see "Server/Client split" gotcha below.
  NasViewerClient.tsx  'use client'. Owns mock/real data + selection
                      state, reads ?angle=/?ref= query params, renders
                      fui-components chrome (Panel, Typography, side
                      stats list) AND dynamic-imports the Scene.
  NasScene.tsx          'use client'. The browser-only half: wires
                      ModelViewer to the model component, computes
                      cameraRadius/min/maxDistance from the model's
                      bounding diagonal. Exists as its OWN file purely so
                      NasViewerClient can `next/dynamic(() => import(...),
                      { ssr: false })` it — R3F's <Canvas> cannot run
                      server-side.
```

## Visual style: Tron-style line art (the house look)

This is not a photoreal product-shot style — it's deliberate technical
line art, like a HUD schematic. Get this wrong and the model reads as "low
rez videogame item" instead of "sci-fi mission-control hardware." Rules,
most important first:

1. **Every fill is unlit near-black.** Use `THREE.MeshBasicMaterial`
   (ignores all scene lighting) with a near-black color
   (`materials.void` in the NAS config, e.g. `#05070A`). Its only job is
   correct depth-sorting/hidden-line removal — it should read as _absence_,
   not as a lit solid object. **Never use `MeshStandardMaterial`/PBR
   shading for body fills in this style** — that produces the "low rez
   videogame" look the user explicitly rejected mid-build.
2. **Every shape also gets a line-art outline over every edge**, via
   `EdgedMesh` (wraps `THREE.EdgesGeometry`). This applies to both 3D
   volumes (boxes → real fold edges) and flat 2D shapes (planes, circles →
   `EdgesGeometry` correctly extracts just the boundary, since internal
   coplanar edges have ~0° between adjacent faces and get dropped). Detail
   density — "intricate lines," not a plain box — comes from wrapping
   **every** sub-feature (every LED window, every port cutout, every trim
   strip, every button) in its own `EdgedMesh`, not just the outer chassis.
3. **One or two colors, total.** One dominant line color
   (`materials.edgeHighlight`) plus at most one secondary accent
   (`materials.ledActivity`, used sparingly — status LEDs, a "healthy"
   indicator). Don't introduce a third color, and don't recolor different
   parts of the chassis differently "for realism" — that breaks the
   Tron read immediately.
4. **Bloom sells it.** Flat MeshBasicMaterial lines alone look thin/flat;
   `ModelViewer`'s `bloom` prop (`@react-three/postprocessing`'s `<Bloom>`)
   gives them a glow. Pass `bloom` (defaults to a tuned
   `luminanceThreshold`/`intensity` — see `ModelViewer.tsx`) and `lit={false}`
   (the PBR lighting rig is dead weight against unlit materials) from the
   model's `Scene.tsx`.
5. **Dense repeated detail (vents, grilles) should be a dot grid, not
   individually outlined.** `TopVent`/`SidePanelVent` use drei's
   `<Instances>` for ~100–200 small flat dots (one draw call) rather than
   wrapping each in its own `EdgedMesh` — per-hole line art at that count
   adds draw calls for no visible gain. Density alone reads as "intricate"
   here; reserve per-feature `EdgedMesh` outlines for things a viewer would
   actually look at individually (buttons, ports, bay trays).
6. **Branding as stroked text, not filled.** `brand-texture.ts` renders a
   wordmark to an off-screen canvas with `ctx.strokeText` (not
   `fillText`) in the line color — keeps a logo consistent with "everything
   is a line," never a solid block of color.

### Color palette (exact values, from `models/nas/config.ts`)

| Role                                            | Hex       | Notes                                                                                                                                      |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Void fill (`materials.void`)                    | `#05070A` | Near-black; every solid body.                                                                                                              |
| Dominant line color (`materials.edgeHighlight`) | `#02FBFF` | Bright cyan — nearly every outline, at varying `opacity` (`edge` 0.85, `edgeDim` 0.45, `edgeSelected` 1.0).                                |
| Secondary accent (`materials.ledActivity`)      | `#4FA884` | Green — used only for a secondary LED/status indicator.                                                                                    |
| Second LED hue (`materials.ledPower`)           | `#03BEFF` | A second small accent for paired LEDs (power vs. activity) — still reads as "one family" with the dominant cyan, not a third distinct hue. |

These map to the `@abbottland/fui-components` brand token file
(`packages/fui-components/src/tokens/colors.ts`) — `primary[600]`,
`success.DEFAULT`, `secondary.DEFAULT` respectively — but **models take
plain hex strings in their own `config.ts`**, not a live import of the
token module. Only `components/viewer-theme.ts` imports the token module
directly (for viewer chrome, not model geometry). If brand tokens change,
update the hex literals in each model's config by hand — this is a
deliberate decoupling, not an oversight.

### What NOT to do (things tried and reverted this build)

- Don't use solid-shaded PBR materials with a studio lighting rig — looks
  like a "product render," not line art, and was the very first (wrong)
  interpretation of "sci-fi mission-control aesthetic" in this build.
- Don't make hover/select states bright full-emissive glows — tune
  `emissiveIntensity`/line `opacity` conservatively (see `edgeDim` vs
  `edge` vs `edgeSelected` in `materials.ts`) or it reads as "glowy," which
  the user explicitly asked to avoid ("legible rather than overly glowy").
- Don't guess a directional-pad/diamond button layout "because it looks
  nav-like" — match the reference photo's actual button shape/layout
  (this build guessed a circle diamond, photo showed a 2x2 square grid;
  always defer to the photo over assumption).

## Reference photo workflow

### Folder convention

```
apps/home-hud/public/<descriptive-slug>/photos/
  front.jpg
  rear.jpg
  left.jpg
  right.jpg
  top.jpg
  bottom.jpg
  threeQuarter.jpg
```

Must live under `public/` (not colocated with the model's source) because
Next.js only serves static assets from `public/` — the `?ref=<angle>`
overlay and capture script both load these over HTTP. Not every angle is
required; front + top + rear covered the structural essentials for the
NAS. Tell the user exactly this path when they ask where to put photos.

**Naming note**: the NAS's photos live at `public/nas-asustor/photos/`
and renders at `nas-asustor-renders/` — a more descriptive slug than the
bare model/route slug (`nas`). This was inconsistent with the route path
(`/infra/viz/nas`) in this build; for the next model, pick **one** slug
and use it everywhere (route dir, `models/<slug>/`, `public/<slug>/`,
`<slug>-renders/`) to avoid the mismatch this build has.

### `models/<slug>/REFERENCES.md`

A running log, per model, of:

- Which of the 7 standard angles exist (checklist table).
- What the photos corrected vs. what the first (photo-less) guess got
  wrong — **write this down each time**, it's the evidence trail for why
  a number is what it is, and prevents re-guessing the same thing wrong
  in a later session.
- What's still approximate (exact mm dimensions almost always are,
  unless someone measures the real hardware).
- A "Visual style" section reiterating the model-specific palette/approach
  decisions (even though the general rules live in this guide, a quick
  per-model note on anything non-default is worth keeping local).

### Camera angle + overlay query params

`NasViewerClient.tsx` reads two search params on `/infra/viz/<slug>`:

- `?angle=<name>` — sets a fixed starting camera position (one of the
  7 named angles from `camera-angles.ts`) and **disables idle
  auto-rotate** (a rotating camera defeats a reproducible comparison
  shot).
- `?ref=<name>` — overlays the matching `public/<slug>/photos/<name>.jpg`
  semi-transparently over the canvas, for eyeballing alignment.

### Capture script

`scripts/capture-<slug>.mts` (copy `scripts/capture-nas.mts`): a plain
Playwright script (chromium, launched directly — not the full
`playwright test` runner/webServer machinery `apps/blog` uses, that's
overkill for a one-off capture tool) that:

1. Requires the dev server already running on `localhost:4022` (does not
   start it).
2. For each of the 7 standard angles, navigates to
   `/infra/viz/<slug>?angle=<angle>`, waits for the canvas, screenshots
   just the canvas element.
3. Writes PNGs to `<slug>-renders/` at the app root (gitignored — add the
   line to `apps/home-hud/.gitignore`).

Add a `"capture:<slug>": "tsx scripts/capture-<slug>.mts"` script to
`package.json` next to the existing `capture:nas`.

## Low-fidelity → high-detail workflow (the actual loop that worked)

1. **Scaffold the skeleton first, render _something_.** Copy the NAS's
   file layout for the new model (config/materials/types/parts/assembly +
   route files). Start with just a `Chassis` (one box, one `EdgedMesh`)
   wired all the way through `ModelViewer` → the route. Confirm it
   actually renders in a browser before adding a single other part — this
   catches import-path and SSR/`'use client'` boundary mistakes while the
   diff is still tiny (see Gotchas below; these mistakes are easy and this
   build hit two of them).
2. **Get dependencies installed and the dev-route reachable before
   worrying about geometry.** `pnpm --filter @abbottland/home-hud dev`,
   confirm `http://localhost:4022/infra/viz/<slug>` 200s and shows a
   canvas before iterating further.
3. **Build structure from general knowledge, flag every guess.** Before
   photos exist, build a plausible generic version of "what this kind of
   device looks like" (right ballpark part count/layout) — but write every
   guessed number into `REFERENCES.md` immediately as a guess, not a fact.
   Expect this to be wrong in specific ways once real photos arrive (this
   build's first guess had the wrong bay count, bay orientation, and
   several front-panel details — all corrected in round 2 once photos
   existed).
4. **Get real reference photos, then do a structural-correctness pass
   BEFORE a cosmetic pass.** Fix layout/counts/proportions/orientation
   first (e.g. "6 bays in a horizontal row, not 4 stacked vertically") —
   these are foundational and ripple through every part file. Only once
   structure is right, do a detail pass (latch shape, LED window shape,
   trim strips, button shape/layout, spacing/margins).
5. **Apply the line-art rendering pass.** If the model was built
   solid-shaded first (or if a user explicitly corrects the aesthetic
   mid-build, as happened here), this is a mechanical but repo-wide
   change: swap every part's materials for `void`/`edge*` pairs via
   `EdgedMesh`, strip the PBR lighting rig (`lit={false}`), add `bloom`.
6. **Screenshot-verify after every meaningful change — don't trust a
   description of what you expect to see.** This build caught, only by
   actually screenshotting: a routing bug that broke the whole page, wrong
   camera framing (clipped feet), overexposed emissive highlights, and a
   wrong button layout versus the photo. Use the throwaway-server pattern
   below.
7. **Iterate detail density, not just color.** "More detail" usually means
   _more parts wrapped in `EdgedMesh`_ (trim strips, bezels, port cutouts,
   hinge seams), not brighter colors or more colors.

## Commands

| Command                                                         | What for                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @abbottland/home-hud dev`                        | Dev server, port 4022 (`next dev --webpack` — Turbopack silently breaks the proxy `assetPrefix`, don't drop `--webpack`).                                                                                                                                                                                 |
| `npx tsc --noEmit -p tsconfig.json` (run from `apps/home-hud/`) | Typecheck. **Run directly, not through a subshell `&&` chain with `pnpm dev` output, and never pipe through `tail`** — see the exit-code gotcha below. There's no standalone `pnpm typecheck` script; `next build` also typechecks but see the build-vs-dev-server conflict gotcha first.                 |
| `pnpm --filter @abbottland/home-hud lint`                       | ESLint.                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @abbottland/home-hud test:unit`                  | Jest, pure config/geometry-helper tests (e.g. `tests/unit/nas-config.unit.test.ts`). Add one per model for any derived-position math (`computeXPositions`, margins/fit assertions) — cheap and catches layout regressions a screenshot won't (a subtly wrong number that still "looks fine" at a glance). |
| `pnpm --filter @abbottland/home-hud capture:nas`                | Playwright screenshot capture, all 7 angles → `nas-asustor-renders/`. Copy per new model.                                                                                                                                                                                                                 |

### Screenshotting without a dedicated test harness

No Playwright `playwright.config.ts`/test-runner is set up for this app (unlike
`apps/blog`). For ad hoc visual verification during a build, write a
throwaway `.mjs` script **inside** `apps/home-hud/` (so it resolves
`node_modules`), launch chromium directly, screenshot, then delete the
script:

```js
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
await page.goto('http://localhost:4022/infra/viz/<slug>', {
  waitUntil: 'load',
  timeout: 45000,
});
await page.waitForSelector('canvas', { timeout: 45000 });
await page.waitForTimeout(5000); // let bloom/materials settle
await page.screenshot({ path: '/absolute/scratch/path.png' });
await browser.close();
```

**Before starting a dev server, check if one's already running**
(`ss -ltn | grep 4022`) — the user may already have one open in their own
terminal. If so, don't start a second one (port conflict) and don't run
`next build` concurrently (`next build` and `next dev` share the `.next/`
directory's lock file and `next build` will hang indefinitely, not error,
waiting for a lock a long-running `dev` process never releases — kill the
build, not the dev server, if this happens and you don't know whose dev
server it is). If nothing is listening, start one yourself with
`nohup pnpm dev > /tmp/log & disown`, wait for `"Ready in"` in the log,
screenshot, then `kill` the PID you started — don't leave a server you
started running after you're done.

## Gotchas hit while building the NAS model (don't re-learn these)

- **A `tsc ... | tail -N` exit code is `tail`'s, not `tsc`'s.** Bash
  reports the last command in a pipe's exit status. This build trusted a
  misleading "exit 0" from a piped command and shipped six broken import
  paths before catching it by actually reading the output file content.
  **Redirect to a file and check that file's content directly
  (`tsc ... > out.txt 2>&1; echo $?`, then read `out.txt`) — don't pipe
  through `tail`/`head` for anything you're trusting as pass/fail.**
- **Server/Client component split**: `page.tsx` (Server Component) must
  **never** import from `@abbottland/fui-components` directly — that
  package's bundle touches client-only hooks, and Next will throw "You're
  importing a module that depends on `useState` into a Server Component."
  Put any fui-components usage (`Typography`, `Panel`, etc.) in the
  `*Client.tsx` file instead. `hosts/page.tsx` is the existing
  house-convention example — new routes should match it.
- **Relative import depth from `models/<slug>/parts/*.tsx` to
  `components/*.tsx`**: it's three levels up
  (`../../../components/EdgedMesh`), not two. `parts/` → `models/<slug>/` →
  `models/` → `viz/` is where `components/` lives. Getting this wrong
  compiles fine with `tsc` sometimes being slow to surface it in a
  pipe-masked check (see above) — verify the actual browser console, not
  just a type-check, after adding new part files.
- **`next/dynamic(..., { ssr: false })`** must be called from inside a
  Client Component (`NasViewerClient.tsx`), not a Server Component — this
  is a Next 16 / React 19 restriction. It's also _why_ the Scene file
  (`NasScene.tsx`) exists as a separate module from the Client file: R3F's
  `<Canvas>` would otherwise get pulled into the server bundle.
  _(Note: this app is on Next 16 / React 19 — it has breaking changes vs.
  older Next.js. See `apps/home-hud/CLAUDE.md`'s "This is NOT the Next.js
  you know" note and read `node_modules/next/dist/docs/` before writing
  routing code you're not 100% sure still works the same way.)_
- **Derive dependent layout values; don't hardcode two numbers that must
  stay in sync.** The bay row's per-bay width used to be a fixed config
  number that could silently overlap the header's left strip width if
  either was tuned independently. Fixed by making bay width a _derived_
  function (`computeBayWidth(config)`) of the available space
  (`chassis width − leftStripWidth − margins`), so there's exactly one
  source of truth. Watch for this pattern (two config numbers that are
  only valid together) in future models and derive instead of duplicating.
- **`React.ComponentRef<typeof SomeDreiComponent>`** (not importing the
  underlying `three-stdlib` type directly) is the safe way to type a ref
  to a drei component like `OrbitControls` — importing from `three-stdlib`
  directly risks a "phantom dependency" resolution failure under pnpm's
  strict linking (it's a transitive dep of `@react-three/drei`, not a
  declared dependency of this app).
- **R3F auto-disposes objects assigned via props on unmount by default**
  (unless a mesh sets `dispose={null}`) — fine for geometries/materials
  owned by a single part instance, but don't let multiple meshes share a
  component-scoped-but-not-truly-shared material unless you're sure about
  the unmount lifecycle. This codebase handles true cross-mesh shared
  materials via `useNasMaterials`'s own `useEffect` cleanup (disposes once,
  at the whole model's unmount), not by relying on R3F's per-mesh default.
- **"Positive Z is toward the camera" is only true on the +Z (front) face
  — it flips on every other face.** Stacking a detail on top of another
  flat panel (e.g. an inner "tongue" rect inside a port outline) needs a
  small Z offset so it isn't depth-occluded by the parent's opaque fill.
  On the front face that offset is positive (`frontZ + 0.05` etc. — see
  `HeaderPanel.tsx`). On the **rear** face (negative Z, camera on the
  negative side), "toward the camera" means **more negative**, so the
  same `+0.02` pattern copy-pasted from a front part hides the detail
  behind the parent instead of in front of it (found live on the NAS's
  USB/power-pin overlay details — they rendered but were invisible until
  the sign was flipped to `-0.02`). Same logic applies to the left
  (−X)/right (+X) faces: check which direction is actually "outward" for
  that specific face before copying an offset pattern from a different
  face.
- **Mirrored left/right on the rear face is an easy, easy-to-miss bug.**
  Viewing the back of any object flips an observer's sense of left/right
  relative to a world axis that was defined from the front — so rear-face
  part positions authored by eyeballing "roughly matches the photo" can
  come out mirrored even when every individual number looks reasonable.
  If the user says a rear (or any non-front) face "looks mirrored
  compared to the reference photo," the fix is almost always negating
  every X coordinate in that face's config block, not repositioning
  individual elements by feel.

## Checklist for the next model

1. `mkdir -p src/app/infra/viz/models/<slug>/parts`
2. Copy `config.ts`/`materials.ts`/`types.ts` from `models/nas/`, strip to
   just a `dimensions` + one part, following this guide's palette (same
   hex values — only introduce new colors if the model genuinely needs a
   different "family," and say so explicitly, don't default to it).
3. Write one `parts/Chassis.tsx` (literally copy `nas/parts/Chassis.tsx`,
   it's generic), wire it through a new `<Model>.tsx` assembly component.
4. `mkdir -p src/app/infra/viz/<slug>`, copy `page.tsx`/`*Client.tsx`/
   `Scene.tsx` from `viz/nas/`, rename, swap the imported model.
5. Confirm it renders (`pnpm dev`, visit the route, screenshot) before
   adding more parts.
6. `mkdir -p public/<slug>/photos`, add a `.gitkeep`, write
   `models/<slug>/REFERENCES.md` with the 7-row checklist (all unchecked).
7. Ask the user for photos; once they exist, do the structural-correctness
   pass (step 4 of the workflow above) before the cosmetic detail pass.
8. Copy `scripts/capture-nas.mts` → `scripts/capture-<slug>.mts`, add the
   `capture:<slug>` package.json script, add `<slug>-renders/` to
   `.gitignore`.
9. Add a unit test for any derived-position math, following
   `tests/unit/nas-config.unit.test.ts`.
10. Add a one-line pointer to the new model's `REFERENCES.md` in
    `apps/home-hud/CLAUDE.md` if it's substantial enough to be worth a
    future session finding quickly (follow the existing index-entry
    pattern in that file).
