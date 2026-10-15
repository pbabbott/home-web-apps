# Beelink SER5 reference photos

Source photos live in `apps/home-hud/public/beelink-ser5/photos/` — see
`SOURCES.md` there for where each came from.

## What we actually have

| Filename      | What it shows                                                                                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `front.jpg`   | **Dead-on orthographic shot.** Clean front face: mesh-textured upper half, thin trim strip, glossy lower bezel with the full I/O row (2x USB 3.0, USB-C, mic pinhole, headphone jack, red power button) and a `CLR CMOS` silkscreen label.                                                                                           |
| `rear.jpg`    | **Dead-on orthographic shot** (user-provided). Replaces the earlier rotated-3/4-shot reconstruction. Three wide horizontal slot grilles across the top; below them LAN, a stacked USB 3.0/2.0 pair, DisplayPort+HDMI sharing a dark recessed-look surround plaque, and a DC barrel jack — see Corrections below for what this fixed. |
| `beelink.jpg` | 3/4 marketing hero with two units — one lying flat (shows front + both side faces + top), one standing on end (shows the rear face at an angle, superseded by `rear.jpg`). Used for the top vent and both side vents.                                                                                                                |

## Corrections

- **Chamfer axis.** First version called `createChamferedBoxGeometry` the
  same way Pironman4 does, which puts the full octagon end-caps on the
  chassis's ±X (left/right) faces — on a tower that reads fine, but on
  this low wide box it made the small 113x42 left/right faces look
  dramatically "rounded" while the 126x42 front/back faces barely showed
  the bevel at all. User correction: "the rounded edges are on the top and
  bottom — not on the sides." Fixed in `parts/Chassis.tsx` by swapping
  width/height into the call and rotating the result 90° around Z, which
  moves the full octagon onto ±Y (top/bottom) instead — giving the
  rounded-rectangle footprint real mini PCs actually have, with flat
  left/right/front/back side faces (just a thin corner-chamfer strip at
  their very top/bottom edges). `TopVent`'s border swapped from a plain
  rect to `createOctagonBorderGeometry` (it now traces the chamfered
  footprint) and `SideVents`' border swapped the other way, to a plain
  rect (the side faces are no longer chamfered).
- **Dot size.** First pass used the same `holeRadius` (~1.2) and row/col
  counts as the NAS/Pironman4's sparser vents — read as too chunky at this
  model's scale. Shrunk to ~0.45-0.55 and roughly doubled row/col density
  (`topVent`, `sideVent`, `frontPanel.vent` in `config.ts`) per explicit
  user feedback ("dots in the various dot grids need to be a lot
  smaller").
- **Front face vent removed entirely.** An earlier pass added a dot-grid
  vent patch to the front face itself (the mesh texture appears to wrap
  down from the top in the reference photos) — the user asked to drop it
  ("front face still has dots. let's get rid of them there"). `config.ts`'s
  `frontPanel.vent`/`ventWidth`/`ventHeight`/`ventOffsetY` and the matching
  render code in `parts/FrontPanel.tsx` were removed outright, not hidden.
  The AMD trim band stayed, moved up near the top edge (`trimOffsetY: 14`,
  within the flat non-chamfered zone) since it no longer needs to sit
  between a vent and the I/O row.
- **I/O row centered vertically.** Same correction round: "buttons and
  controls on the front face need to be center aligned to the horizontal
  middle." `frontPanel.bezelOffsetY` moved from -12.5 (low, under where
  the removed vent used to end) to 0 (the face's own horizontal midline).
- **AMD trim band + wordmark removed entirely.** User: "there's a long
  thin line on the front face that says amd, and we should get rid of it
  and the text." Dropped `frontPanel.trimWidth`/`trimHeight`/`trimOffsetY`/
  `brandText`/`brandWidth`/`brandHeight` from `config.ts` and the matching
  trim-plane + `useBrandTexture` render code from `parts/FrontPanel.tsx`
  outright — front face is now just the bare I/O row, nothing else.
- **Front bezel plate added.** User: "the front face has a rectangular
  bezel with some lightly rounded edges." Added `frontPanel.bezel` (its
  own small chamfered-corner box via `createChamferedPanelGeometry`, same
  technique as the Pironman4's front plate) proud of the chassis front
  face by `bezel.depth`, sized to contain the I/O row with margin. Ports
  now mount on the bezel's own outer face, not directly on the chassis
  front face.
- **Side vent panel sized down, twice.** First pass ran the dot-grid panel
  edge to edge on the left/right faces — user: "side panels with the dots
  are too big... should be like half the current size." Added a uniform
  `scale` (0.5). Follow-up: "that's maybe too small. Height should be
  about 80% of the face, and width should be about 60%." Replaced the
  uniform `scale` with independent `widthScale`/`heightScale` on
  `sideVent` (0.6/0.8) — `parts/SideVents.tsx` applies width to the face's
  depth axis (its visual "width" when looking straight at the side) and
  height to the chassis height axis.
- **Front buttons re-spaced and shifted right.** User: "buttons on the
  front panel need to be more evenly spaced, and somewhat aligned to the
  right." The original positions were taken straight off eyeballing
  `front.jpg` and had uneven center-to-center gaps (7-13mm). Re-laid-out
  on a uniform 11mm center-to-center pitch and shifted right (leftmost
  port -15 -> rightmost power +40, vs. the old -14 -> +33), leaving open
  space on the left side of the bezel. Not a photo-accuracy change — a
  deliberate stylization past what the photo shows, per explicit request.
- **Power symbol icon added.** User: "can we add the power symbol in white
  (neutral 300 maybe?) so that it matches the picture." Added
  `materials.powerIcon` (`#C8D9DE`, fui-components neutral-300) to
  `config.ts`/`materials.ts`, and a broken-ring + vertical-bar icon (the
  universal power glyph) drawn over the red glow in `parts/FrontPanel.tsx`'s
  `Port` component, sized off `buttonRadius`.
- **Rear layout re-aligned.** User: "it seems like we have a mess of
  shapes with no real sense of alignment [on the back]." The first pass
  had inconsistent center-to-center spacing (7-14mm) and wildly different
  heights (vent slots at 24mm towering over 4mm USB ports, DC-in offset
  2mm off the shared midline). Re-laid-out `rearPorts`/`rearVentSlots` on
  one uniform 11mm pitch (same pitch as the front panel's buttons, for a
  consistent house rhythm) and one shared vertical midline (`y: 0`
  everywhere); vent slot height cut from 24 to 14 so they read as part of
  the row instead of dominating it; DP/HDMI widths matched to the USB
  ports' 9mm for a cleaner repeated rhythm.
- **CLR CMOS label dropped.** Its `position: [-26, 6]` sat 6mm above the
  row's own midline (it was positioned relative to the pre-recenter bezel
  layout) — once everything else moved to `y: 0`, it read as a stray
  off-axis rectangle. User: "there is one rogue rectangle on the front
  face that is not middle aligned. delete it." Removed outright from
  `config.ts`'s `frontPanel.ports`, not repositioned — it was a label
  silkscreen, not a functional port, so dropping it loses no I/O.
- **Rear face rebuilt from a real dead-on photo (`rear.jpg`), replacing
  two structural guesses from the rotated-3/4-shot reconstruction:**
  - **Vents are 3 wide horizontal slot grilles across the TOP of the
    face**, not tall vertical dividers between port groups. Old:
    `width: 5, height: 24` bars at `y: 0`. New: `width: 27, height: 3`
    slots at `y: 9` (above the port row entirely), confirmed directly from
    the photo.
  - **USB is a vertical 2-port stack (3.0 over 2.0), not two side-by-side
    ports.** Both `usb-3`/`usb-2` now share one `x` (14) with different
    `y` (1.5 / -5.5) instead of the old side-by-side `x: 22`/`x: 11` pair.
  - **DP+HDMI share a visible dark recessed-look surround plaque**, a real
    photo-confirmed feature (unlike the Pironman4's rear, where a similar
    plaque was tried and dropped because it was a _guess_ at a recess —
    see that model's REFERENCES.md). Added `rearShields` (new config
    array + `parts/RearPanel.tsx` render pass) at a smaller proud-epsilon
    than the ports (`shieldZ = rearZ - 0.02` vs. `detailZ = rearZ - 0.05`)
    so it renders visibly behind them, not occluding or floating in front.
  - LAN/DP/HDMI/DC-in widths and positions re-measured off the new photo
    (LAN 14x14 at x:33; DP 14x8 at x:-6; HDMI 13x8 at x:-25; DC-in 8dia at
    x:-48), replacing the earlier uniform-11mm-pitch stylization — this
    round prioritizes photo fidelity over artificial evenness, unlike the
    front panel's button spacing (which stays a deliberate stylization,
    see above).

- **Rear vents made taller + grate texture.** User: "Vents should be a
  little taller and have some vertical lines to appear like a grate."
  `rearVentSlots` height bumped 3 -> 5. `parts/RearPanel.tsx`'s `VentSlot`
  split into `Shield` (plain rect, used for the DP/HDMI plaque) and
  `GrateSlot` (border + a row of vertical `lineSegments` slats, density
  scaled off slot width) — vents now render through `GrateSlot`.
- **DP/HDMI shape: trapezoid.** User: "Hdmi and display ports should be
  more trapesoidal rather than just square." Added a `'trapezoid'`
  `PortSpec.shape` (wider bottom edge, narrower top, via
  `createTrapezoidGeometry` in `parts/RearPanel.tsx`) and applied it to
  both ports. A deliberate stylization past strict photo fidelity (the
  real connectors in `rear.jpg` read closer to rectangular at this scale),
  per explicit request.
- **Vents nudged up.** User: "Translate them up just a bit." `y` moved
  9 -> 10.5 in `rearVentSlots`; top edge now sits at 14.5, just inside the
  15mm flat-zone boundary before the top/bottom chamfer starts.
- **Vents taller + evened out.** User: "The 3 vents should be a bit
  taller and be more evenly spaced among themselves." Height bumped 5 ->
  8; centers moved from an uneven 29/-1/-29 (30mm then 28mm pitch) to an
  exact symmetric 29/0/-29 (29mm pitch both sides) in `rearVentSlots`.
- **DP/HDMI shield plaque shrunk.** User: "Bounding box around display
  and hdmi is too big. It should not overlap other things." The first
  pass (36x16) was tall enough to read as crowding the vent row above it.
  Shrunk to a tight fit (35x11, ~1.5mm margin around the two ports) in
  `config.ts`'s `rearShields`.
- **LAN shape: RJ45 silhouette.** User: "Ethernet port is just a
  square.. maybe it can get a little more shape to [it]." Added a
  `'rj45'` `PortSpec.shape` (chamfered bottom corners + a small top-center
  release-clip notch, via `createRj45Geometry`) and applied it to `lan`.
  Same kind of stylization as the trapezoid DP/HDMI — not sourced from a
  new photo detail, just breaking up the plain-square read.

## Design decisions

- **Power-button accent is RED (`materials.ledActivity` = `#FF3B30`)**, not
  the usual blue/green family every other model in this collection uses
  (NAS: green `#4FA884`/blue `#03BEFF`; Pironman4: blue `#03BEFF`).
  Confirmed deliberately with the user — the real SER5's power button is a
  bright red ring, a signature-enough feature to break from the sibling
  palette for. Still within the house "one dominant + one accent" rule —
  just a different accent hue.
- **Chamfer axis matches Pironman4's convention**: `createChamferedBoxGeometry`
  puts the chamfered-octagon profile on the chassis's **±X (left/right)**
  faces, not front/back or top/bottom. The real unit's visible bright trim
  band runs around the whole perimeter at the lid/base parting line, but
  modeling it everywhere would need a different primitive — only the side
  faces get the octagon cut here, matching the existing component. Top and
  front/back are plain rectangles.
- **Front face got a vent patch too** (not just the I/O bezel) — both
  reference photos show the mesh texture wrapping down over the _top_ of
  the front face, not stopping at the top edge. Split into: upper vent
  patch, a thin trim band carrying the "AMD" wordmark, then the glossy
  lower bezel with the I/O row. This is a deliberate addition beyond the
  original plan (which only specced the I/O row) once the photos made the
  front-face vent visible.
- **Top and side vents are "contained by a panel"** (a thin rectangular/
  octagon border traced just inside the face's own edge) per explicit user
  ask, even though neither reference photo shows a hard frame line around
  the mesh texture — the house style treats this as acceptable embellishment,
  same as the Pironman4's FanGrille border.

## Known approximations / unconfirmed

- **All exterior dimensions** (`chassis.dimensions`: 126x113x42mm). The only
  number found anywhere is from `SOURCES.md` — pulled off a rejected
  reference image for the sibling "SER5 5560U" SKU, unconfirmed for this
  5500U unit. Right ballpark for a squat mini PC; not measured.
- **Rear (-Z) port layout is now sourced from a real dead-on photo**
  (`rear.jpg`) — left-to-right order (LAN, USB 3.0/2.0 stack, DisplayPort,
  HDMI, DC-in) and the 3-vent-slots-on-top structure are confirmed, not
  guessed. Exact mm positions are still eyeballed off the photo, not
  measured. The port _list_ also matches SOURCES.md's text-sourced
  cross-reference (LAN, 2x USB 3.2, USB 2.0, DP 1.4, HDMI 2.0, DC) across
  3 review sites — now with USB 2.0 included (the pre-`rear.jpg` version
  had dropped it for lack of a confirmed position).
- **Front I/O exact mm positions/sizes** are eyeballed against `front.jpg`,
  not measured (same caveat as every model in this collection).
- **Mirrored-left-right risk on the rear face** (see
  docs/home-hud-3d-model-guide.md's rear-face gotcha) — the X-negation
  convention was confirmed correct once already (an earlier render showed
  LAN, the only square port, on the wrong side) and carried forward
  unchanged into the `rear.jpg` rebuild. If a render ever reads mirrored
  vs. the photo again, negate every X in `config.ts`'s `rearPorts`,
  `rearShields`, and `rearVentSlots`.
- **Side vent row/col counts (8x20) and top vent (20x24)** are density
  guesses tuned by eye in-render, not measured from the photo's actual hole
  count.

## Still to do

- [ ] Get left/right/top/bottom dead-on shots if ever available — would
      let the vent density and side proportions be corrected from a photo
      instead of eyeballed.
- [ ] Confirm exact chassis dimensions against the real hardware.
