# Pironman4 reference photos

Source photos live in `apps/home-hud/public/pironman4/photos/`, pulled
from the SunFounder product listing
(https://www.sunfounder.com/products/raspberry-pi-4-case).

## What we actually have (not the standard 7-angle set)

Unlike the NAS, no orthographic front/rear/top shots exist — every photo
on the listing is a 3/4 hero angle or a detail crop. Saved files:

| Filename                   | What it shows                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `threeQuarter-1.jpg`       | Front-left 3/4 hero shot — front panel (OLED, power button, PIRONMAN logo), chamfered top corners, tower cooler fan visible through clear side panel. Held in a hand for scale.                                                                                                                                        |
| `threeQuarter-2.jpg`       | Same angle, different staging (keyboard in frame for scale).                                                                                                                                                                                                                                                           |
| `threeQuarter-labeled.jpg` | Same angle with callout labels: Tower Cooler, OLED, Safe Shutdown (button), GPIO Pins, IR Receiver. Labels are reference-image annotations, not device features.                                                                                                                                                       |
| `side-ports-labeled.jpg`   | **The only port-layout reference** — one side panel, angled (not dead-on), labeled: Camera, USB 3.0 (x2), USB 2.0, Micro SD, Power. Also shows the Pi 4's own HDMI1/HDMI2/AUDIO/POWER silkscreen visible through a clear window below the case's own ports — that's the Raspberry Pi board itself, not a case feature. |
| `cooler-airflow.jpg`       | Same hero angle, airflow arrows overlaid (intake top, exhaust sides) — confirms vent direction, not new geometry info.                                                                                                                                                                                                 |
| `ssd-detail.jpg`           | Internal M.2 SSD closeup — no exterior geometry value.                                                                                                                                                                                                                                                                 |
| `exploded-parts.png`       | Full 27-part exploded diagram (aluminum case, tower cooler, acrylic plates, RGB LED strip, OLED, power switch, GPIO bridge, standoffs/screws). Confirms what's structurally real; not a usable photo angle.                                                                                                            |
| `back-ports.jpg`           | **Real close-up of the rear face** (user-captured, not a listing photo) — dead-on, labeled: Camera, LAN, USB (x2 blue, USB 3.0), USB (x2 black, USB 2.0), micro SD, SSD, Power. Landscape orientation. The only rear reference; replaced the earlier reinterpreted-from-a-side-photo guess.                            |

## Corrections

Several rounds of trial-and-error before the chassis shape and part
layout landed where they are now — kept here so the reasoning isn't
re-litigated:

- **Chassis chamfer axis.** The chassis is a box whose **left and right
  (±X) faces** are themselves chamfered octagons (cut at their own
  top/bottom corners, in the depth×height plane) — not the front/back,
  and not the top/bottom. Two earlier attempts put the octagon on the
  front/back or the top/bottom faces; both were wrong and were corrected
  via explicit side-by-side `?angle=front` / `?angle=right` renders. See
  `components/chamfered-box.ts` (`createChamferedBoxGeometry`) — the
  octagon shows on a dead-on `?angle=right` render, not `?angle=front`.
- **No feet.** Unlike the NAS, the real case sits flush on its aluminum
  base — `parts/Feet.tsx` and the `feet` config were removed, not just
  hidden.
- **Fan grille moved from the top to the left AND right (±X) faces**,
  mirrored, each with its own thin border traced just inside the face's
  own chamfered-octagon edge, plus 8 screws (2 per flat edge — front/
  back-facing and top/bottom-facing, not the angled chamfer corners)
  centered within that bezel band. The real tower cooler's intake is
  visible through clear panels spanning top and side in the photos; side
  placement (both sides, not just one) is what was asked for here.
- **Ports panel moved from the +X side face to the rear (-Z) face**, then
  **rebuilt from a real rear-face close-up (`back-ports.jpg`)**, replacing
  the earlier reinterpreted-from-a-side-photo guess entirely. The photo is
  landscape; the model's rear face is portrait (width 65 x height 125), so
  the layout is mapped on **90deg clockwise**: photo-right -> model-bottom,
  photo-top -> model-right, photo-left -> model-top. That puts the photo's
  side-by-side USB pairs stacked vertically on the model, and its vertical
  micro SD/SSD/Power column running left-to-right along the model's bottom
  edge. 9 ports total: Camera (thin slot, upper-left, directly on the flat
  aluminum), LAN, 2x USB 3.0, 2x USB 2.0 (center column), micro SD/SSD/Power
  (bottom row, USB-C ports rendered as plain rects — no distinct capsule
  shape). The camera slot is a thin horizontal strip (it's vertical in the
  source photo — the 90deg remap rotates its long axis too). No bounding
  plaque around the port cluster for the photo's sunken dark I/O shield:
  tried one, but the chassis is a closed opaque box, so a plane standing in
  for a recess can only ever sit PROUD of the rear face (a plane placed
  behind it is occluded by the nearer, opaque chassis surface and never
  renders) — proud, it just read as a floating box rather than a recess, so
  it was dropped. Just the bare port cutouts now.
- **Front panel bezel plate is its own small chamfered-octagon box**
  (`createChamferedPanelGeometry`, chamfer on the plate's own front/back
  faces), not a flat plane — it has real depth and sits proud of the
  chassis front face. Went through a few depth/height/position passes
  (see `config.ts` `frontPanel` — plate depth halved twice over several
  iterations, height trimmed, offset nudged up, display recentered).
- **Power button off-center, IR receiver added.** The button sits at
  `buttonOffsetX` (not centered); a small unlit lens dot represents the
  IR receiver (visible in `threeQuarter-labeled.jpg`, callout only — no
  photo shows its actual position), mirrored off the button for visual
  balance.
- **4 corner screws added to the front plate**, inset from the plate's
  own edges, clear of its own (reduced, more-square) chamfer corners.
- **Brand wordmark moved onto the chassis's top-front chamfer facet**
  (the tapered bevel between the top and front faces), not the flat
  front face — this is a real 45° facet since the chassis chamfer is
  equal on both legs. Also fixed a real bug while tuning this: the
  shared `components/brand-texture.ts` was drawing text left-aligned at
  a fixed canvas x-offset regardless of string width, so it was never
  actually centered on the plane it's mapped to (affected the NAS
  wordmark too) — switched to `textAlign: 'center'`.

## Known approximations (no orthographic shots to measure from)

- **All dimensions** (`config.ts` `chassis.dimensions`, `chamfer`,
  `frontPanel.*`, `fanGrille.*`) are tuned by eye against the 3/4-angle
  photos and iterative screenshot review, not measured.
- **Ports panel position/spacing** is now sourced from a real rear-face
  photo (`back-ports.jpg`), but exact mm positions/sizes are still eyeballed
  from that photo via the 90deg orientation remap (see Corrections above),
  not measured. USB-C ports (SSD/Power) are modeled as plain rects, not a
  distinct rounded capsule shape.
- **Power button glow color** (`materials.ledActivity`) uses the fui-components
  brand secondary (`#03BEFF`) — happens to land close to the photo's blue
  glow too, so no tradeoff here between the Tron style's "one dominant + one
  accent color" rule and photo fidelity.
- **IR receiver position** is a visual-balance guess (mirrored off the
  button) — no photo shows where it actually sits on the front panel.
- No brushed-metal/acrylic-transparency simulation — like every model in
  this collection, surfaces are flat void + line art regardless of the
  real material (brushed aluminum vs. clear acrylic read the same here).

## Still to do

- Rear (-Z) face now has a real reference (`back-ports.jpg`) and a full
  9-port layout — fine-tune exact mm positions against a render once the
  dev server is up (eyeballed, not measured). No recessed I/O panel — see
  Corrections above for why it doesn't work in this closed-box style.
- Possibly add a top vent too (or adjust the side split) once a photo
  clarifies the real top/side ratio.
