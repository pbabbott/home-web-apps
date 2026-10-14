# ASUSTOR NAS reference photos

Source photos of the real unit live in
`apps/home-hud/public/nas-asustor/photos/`, so the `?ref=<angle>` overlay
(see `NasViewerClient.tsx`) and `capture-nas.mts` can find them:

| Filename           | View          | Have it? |
| ------------------ | ------------- | -------- |
| `front.jpg`        | Front         | ✅       |
| `rear.jpg`         | Rear          | ✅       |
| `top.jpg`          | Top           | ✅       |
| `left.jpg`         | Left side     | ☐        |
| `right.jpg`        | Right side    | ☐        |
| `bottom.jpg`       | Bottom        | ☐        |
| `threeQuarter.jpg` | Three-quarter | ☐        |

## What the photos corrected

The first pass of this model (built before any photos existed) guessed
wrong on several structural points. Corrected against `front.jpg`/
`top.jpg`/`rear.jpg`:

- **Bay count and layout**: it's **6 bays in a single horizontal row**, not
  4 stacked vertically. `config.ts` `bays.count = 6`; layout math moved
  from `computeBayPositionsY` to `computeBayPositionsX` + `computeBayRowY`.
- **Chassis proportions**: wider-than-tall (`dimensions` width 230 / height
  175 / depth 235mm), not a tall tower.
- **Tray latch**: a small lever at the **bottom-center** of each tray
  (`bays.latchWidth/latchHeight`), not a side grip tab — the earlier guess
  was wrong.
- **Header strip** (`parts/HeaderPanel.tsx`, `config.ts` `header`): a
  brushed left-edge plate with power/activity LED bars, a recessed display
  panel, and a 2x2 nav button cluster — replaces the old per-LED-sphere +
  single power-button guess.
- **Top vent** (`parts/TopVent.tsx`, `config.ts` `topVent`): a perforated
  grille over roughly the rear 2/3 of the top panel, solid in front — not
  modeled at all before.
- **Rear panel** (`parts/RearPanel.tsx`, `config.ts` `rear`): one large
  circular fan + discrete port cutouts (power, 2x ethernet, USB, HDMI,
  Kensington slot) — replaces the generic dot-grille guess.

The "AS6706T" model name is consistent with 6 bays after all (ASUSTOR's
AS67-series genuinely are 6-bay) — the earlier "4-bay" assumption in this
file was the error, not the model number.

## Front detail pass (round 2)

Corrected after a closer read of `front.jpg`:

- **Tray latch**: round captive keyhole lock (`bays.latchRadius`), not a
  rectangular lever.
- **Tray LED windows**: small rectangles (`bays.ledWindowWidth/Height`),
  not circles.
- **Tray edge trim**: thin metallic strips down each tray's vertical edges
  (`bays.trimWidth`, new in `parts/DriveBay.tsx`).
- **Display**: glossy recessed window with its own bezel frame
  (`header.displayBezelMargin`, `materials.displayBezel`), not a flat
  plane.
- **Nav buttons**: directional diamond (up/down/back/enter), not a 2x2
  grid — matches the real button cluster shape.
- **Brand wordmark**: "asustor" rendered via a canvas-texture plane
  (`brand-texture.ts`) near the top of the left strip — now that a clear
  front photo exists, branding is no longer skipped.

## Still approximate

- Exact mm dimensions are estimated from photo proportions, not measured.
- Header/LED/button/port positions are estimated from the photos, not
  pixel-measured — close but not exact.
- Left/right/bottom/three-quarter views are still unconfirmed — the
  chamfered front-right edge visible in `front.jpg`'s 3/4 angle isn't
  modeled yet (chassis is still a plain box).
- No brushed-metal texture/normal map — PBR roughness/metalness values
  approximate the look instead.

Compare `capture-nas.mts` renders against the photos (via `?ref=`) and
correct `config.ts` numbers iteratively from here.

## Rear panel structural pass

Full inventory taken from `rear.jpg` (ignoring the photo's own white
callout/label lines, which are reference-image annotations, not device
features): power inlet, a separate smaller PSU fan next to it, a small
rectangular cover plate top-center, the large main case fan (square
corner-screwed mounting bezel + circular guard), 2x ethernet + 1x USB +
1x HDMI + Kensington slot in a port column, ~10 scattered chassis screws,
2 feet, rounded-rect panel outline.

Implemented in `parts/RearPanel.tsx` / `config.ts` `rear`:

- `RearPortSpec` gained an optional `shape: 'rect' | 'trapezoid'` — HDMI
  type-A ports are trapezoidal (narrower at top), not rectangular; a
  `createTrapezoidGeometry()` helper (plain `THREE.Shape`/`ShapeGeometry`)
  builds it.
- New `ScrewSpec[]` (`rear.screws`) — small outlined circles scattered to
  match the photo's screw layout. Decorative/approximate, not derived
  (unlike structural values like bay width) — absolute positions are fine
  here, same precedent as `ports`.
- New PSU fan + its own square bezel, and a small top-center cover plate
  — both entirely missing before.
- **Main fan guard pattern — corrected twice.** First attempt: a pinwheel
  of radial blade bars (wrong, and some overshot past the ring boundary).
  Second attempt, per explicit correction: **concentric ring arcs, each
  with a gap, rotated against its neighbors** (a "maze" grille), built
  from `THREE.RingGeometry(innerR, outerR, segments, 1, thetaStart,
2π-gap)` — `EdgesGeometry` on a partial ring correctly traces just the
  inner arc, outer arc, and the two straight edges at the gap (coplanar
  internal segment-to-segment edges have ~0° between them and get
  dropped automatically). `fanGuardRotationStepDegrees` uses a
  non-divisor-of-360 value (67°) so the gaps look organically offset,
  not a uniform evenly-spaced pinwheel.

## Rear panel: mirror fix + per-connector detail

- **Left/right was mirrored** versus the rear photo. Every rear X
  coordinate (fan, PSU fan, top plate, all 6 ports, all 10 screws) was
  negated to correct it — viewing the back of any object flips left/right
  relative to the front-facing +X convention, so matching the photo's
  arrangement as seen means negating X throughout that whole config
  block.
- **Port shapes were all generic rectangles** — added real per-connector
  silhouettes so the column reads as distinct connector types at a
  glance: ethernet now has the RJ45 clip-tab notch (`createEthernetGeometry`,
  a single `THREE.Shape` with the notch built into the outline, not an
  overlapping piece), USB has a nested inner "tongue" rect, power (IEC
  C14) has two blade-pin slits + one round ground-pin hole, and
  Kensington has its lock-loop hole next to the slot.
- **Real depth-occlusion bug found while adding those nested details**:
  the overlay details (USB tongue, power pins) were positioned at a
  _positive_ local Z offset, invisible behind the parent port rect's
  opaque fill. On the FRONT face (+Z), a positive offset correctly moves
  toward the camera; on the REAR face (−Z), the camera sits on the
  _negative_ side, so "toward camera" there means a _more negative_ Z — a
  positive offset moves a detail _away_ from a rear-facing camera, into
  occlusion. Fixed by using negative offsets for every rear-panel overlay
  detail. If a future model has detail stacked on any negative-coordinate
  face, check this same sign convention rather than assuming "+ is always
  toward the camera."

## Visual style: Tron-style line art (round 3 — explicit pivot)

The model switched from solid-shaded PBR materials to literal line art,
matching `example-output.png`'s wireframe/HUD treatment directly (the
earlier "restrained solid-shaded + 2D panel" interpretation of that concept
sketch undersold what was wanted — this is the correction):

- Every part fill is **unlit near-black** (`MeshBasicMaterial`, ignores
  scene lighting entirely) — see `materials.ts` `void`/`voidActive`/
  `voidSelected`. It exists only so hidden-line depth-sorting works
  correctly; visually it should read as void/absence.
- Every part also renders a **line-art outline over every edge** —
  `components/EdgedMesh.tsx` is the shared building block: it pairs a
  void-fill mesh with a `THREE.EdgesGeometry` → `LineSegments` outline.
  Every part file (`Chassis`, `FrontFascia`, `HeaderPanel`, `DriveBay`,
  `RearPanel`, `Feet`) now uses `EdgedMesh` instead of a bare `<mesh>`, so
  detail reads as "a series of lines," not solid shapes.
- **Only two colors total**: the dominant line color
  (`materials.edgeHighlight`, cyan) and one secondary accent
  (`materials.ledActivity`, green) used for status LEDs — everything else
  is void-black or the one line color at varying opacity
  (`edge`/`edgeDim`/`edgeSelected`).
- `ModelViewer` gained `lit`/`bloom` props (`components/ModelViewer.tsx`):
  the NAS scene passes `lit={false}` (the old PBR lighting rig is dead
  weight against unlit materials) and `bloom` (new
  `@react-three/postprocessing` + `postprocessing` deps) so the bright
  line color actually glows, selling the Tron look.
- `TopVent`'s ~200 holes are a dense dot grid (via drei `<Instances>`, one
  draw call) rather than per-hole line art — per-hole outlines at that
  count would add draw calls for little visual gain; density alone reads
  as "intricate" here.
- Brand wordmark (`brand-texture.ts`) renders as stroked (not filled) text
  in the line color, to stay consistent with the line-art rule.

If a future pass needs the look more/less intricate: line density comes
from how many parts get wrapped in `EdgedMesh` (add more sub-detail
outlines), glow comes from `Bloom`'s `intensity`/`luminanceThreshold` in
`ModelViewer.tsx`.

## Front detail pass (round 5)

- **Button cluster layout**: was centered tight next to the display with a
  tiny vertical pitch (13mm) — didn't match the photo at all, where the
  2x2 cluster is anchored to the chassis' right edge (independent of
  display width, via `header.buttonClusterRightMargin`) and spans nearly
  the header's full height (`buttonRowPitch` 32mm, not 13mm).
- **Display width**: was a hardcoded guess (96mm) leaving a large dead
  bezel gap before the buttons. Now **derived**
  (`computeDisplayWidth(config)` in `config.ts`) from whatever space is
  actually left between the left strip and the button cluster, so it
  fills the gap and can't drift out of sync if either position changes.
  (No text is rendered on the display — just the recessed panel + bezel,
  per explicit request; "filling the empty space" refers to the panel
  itself, not simulated screen content.)
- **Brand wordmark was invisible**: `brand-texture.ts`'s 3px canvas stroke
  mapped onto a 28mm-wide plane worked out to a sub-millimeter line in
  the actual scene — effectively imperceptible at render distance. Fixed
  by bumping the canvas `lineWidth` to 9 and the plane to 30x8mm. If the
  brand plane size changes again, re-verify this still reads (zoom in and
  check — a thin screenshot at normal camera distance won't show it
  either way, zoom in first).
- **Button cluster packing/position**: was spread across nearly the full
  header height, vertically centered — the photo shows a _tight_ 2x2
  block (edges nearly touching, `header.buttonGap` 1.5mm) anchored to the
  chassis' **top-right corner** (`header.buttonClusterTopMargin`), not
  centered in the header. `computeButtonsCenterY`/`computeButtonPitch` in
  `config.ts` replaced the old centered/spread-out math.
- **Side panel vent coverage, shape, and position**: three corrections in
  sequence. First, coverage shrunk from ~70% of the side face to a
  smaller localized patch. Then, shape/position: the patch should be a
  **rectangle** (taller than wide: 8 rows x 5 cols) **biased toward the
  front edge**, not a centered square — `SideVentConfig` replaced its
  single `marginFraction` with independent `marginFractionY` (vertical),
  `frontOffsetFraction` (gap from the chassis' front edge) and
  `patchDepthFraction` (the patch's own front-to-back span), so position
  and shape are controlled separately instead of one knob that couldn't
  express "off-center."
- **Button cluster height**: was an independently-tuned `buttonSize`
  (10mm) that happened to look okay — now **derived**
  (`computeButtonSize(config)` in `config.ts`) so the 2x2 block's total
  height (`2*buttonSize + buttonGap`) always exactly equals
  `displayHeight`, per explicit request that the button foursquare match
  the LCD height.

## Front detail pass (round 4)

Corrected against a closer front-photo read again:

- **Nav buttons**: back to a **2x2 grid of squares** (not a diamond of
  circles — that was a wrong "correction" in round 2). `header.buttonSize`
  now drives a `PlaneGeometry` square via `EdgedMesh`.
- **USB port**: added to the left strip, near the bottom
  (`header.usbWidth/usbHeight/usbOffsetFromBottom`) — missing before.
- **Bay row spacing**: bays no longer sit flush against the left strip.
  `bays.rowLeftMargin`/`rowRightMargin` reserve space on each side;
  `computeBayWidth()` derives the per-bay width from whatever's left after
  `header.leftStripWidth` + both margins, so the row always fits and never
  drifts out of sync if either number changes later. `bays.bayWidth` (a
  hardcoded field) is gone — read it via `computeBayWidth(config)` instead.
- **Side panel vents**: new `parts/SidePanelVent.tsx` — same dot-grid
  technique as `TopVent`, applied to both the left (`-width/2`) and right
  (`+width/2`) faces via `config.sideVent`.
