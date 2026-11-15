# CLAUDE.md — packages/fui-components

## Architecture

- Built as a library with **Vite** (`build:npm`) and exported as ESM/CJS
- **Storybook 10** for development and documentation
- **Playwright** for screenshot regression tests; **Vitest** for DOM unit tests
- Test stories are auto-generated via `test:playwright:generate`

## Component Catalog

What's available for building UIs (blog, home-hud, diagram-maker, …). Source: `src/components/*`, exports in `src/index.ts`; see each component's `.stories.tsx` for props. **Keep this list current: when you add, remove or rename an exported component, update its bullet in the same change.** Not exported (internal): `BaseButton`, `DiagramControls`, `DiagramMinimap`.

**Layout & surfaces**

- **Panel** – bordered, colored container with corner crosses; default content box.
- **TransparentPanel** – translucent colored panel with corner squares; overlays and content over backgrounds.
- **Card** – clickable content card with color, size and optional dot-grid; link/summary tiles.
- **DotGridBackground** – colored dot-grid backdrop with an `active` state; subtle page or card texture.
- **HexagonalBackground** – animated hex-grid backdrop with sparks; hero/landing backgrounds.
- **HorizontalRule** – gradient-fade divider; section separators.
- **EdgeDrawer** – slide-out side panel with handle and title; secondary/detail content.
- **Scrollbar** – custom tick-style vertical scrollbar (controlled thumb); themed scrolling regions.

**Text & decoration**

- **Typography** – all text, with variants and a polymorphic `component` prop; always use for rendered text.
- **Badge** – small hex-pointed colored label; tags and status.
- **CautionTape** – tilted animated hazard-stripe banner; warnings, "under construction".
- **AIContent** – marks a block as AI-generated with highlight rule and optional glow.
- **MaskReveal** – animated mask reveal for content (direction/duration/delay); entrance animations.

**Buttons & navigation**

- **Button** – primary button (color, variant, size); can render as a link. Default action control.
- **OutlinedButton** – outlined variant with static hover fill; secondary actions and toggle groups.
- **HexagonButton** – hexagonal status-aware button with shimmer/sparks; featured or stateful actions.
- **TiledHexagons** – honeycomb grid of hexagon tiles; launchers and icon menus.
- **NavBar** – top navigation container with decorative line; site header.
- **NavItem** – polymorphic nav link with icons and connector lines; items inside NavBar.

**Forms & overlays**

- **Input** – styled text input with color and active ornament; text entry.
- **Switch** – on/off toggle (Radix); boolean settings.
- **Tabs** – tabs with chamfered style and sliding indicator (Radix); switching views.
- **Modal** – dialog (Radix: Trigger, Close, Content, Title, Description); focused tasks and confirmations.
- **DropdownMenu** – dropdown (Radix: Trigger, Content, Item); action menus.
- **Tooltip** – hover tooltip with delay and optional controlled state; short hints.

**Data display**

- **Table** – Table/TableHead/TableBody/TableRow/Th/Td with color and size, plus `ScrollableTable`; tabular data.
- **SegmentedProgressBar** – step progress bar with shimmering current segment; multi-step flows.

**Diagram** (React Flow based; used by diagram-maker)

- **DiagramViewer** – read-only diagram with fullscreen and active-edge sparks; also exports `IconRendererProvider`/`useIconRenderer`.
- **DiagramEditor** – editable diagram canvas; authoring diagrams.
- **BaseNode** – shared node base (editing, handles, color scheme); build custom nodes on it.
- **DefaultNode** – standard node with content string.
- **LabeledNode** – node with a label.
- **TextNode** – text node with color scheme, read-only mode and icon.
- **BaseEdge** – shared edge base with optional label UI; build custom edges on it.
- **DefaultEdge** – standard unlabeled edge.
- **EditableEdge** – edge with inline-editable label.
- **EdgeSparkEffect** – spark animation along an SVG path (loop or one-shot); highlighting active connections.

## Build tooling

`@microsoft/api-extractor` is pinned to an exact version in both root `package.json` (`pnpm.overrides`, alongside `@microsoft/api-extractor-model`) and this package's `devDependencies`. That version must keep its bundled TypeScript in sync with this repo's `typescript` version (see comment in `vite.config.ts`) — a mismatch doesn't error, it silently produces an empty `dist/index.d.ts`. Bump all three together, never just one.

## Typography

Always use the `Typography` component for all rendered text — no raw `<p>`, `<span>`, `<h*>`, or other HTML text elements. This applies to components and stories alike.

## Storybook Coverage

When adding or changing a prop on a component, add (or update) a story that demonstrates that prop's states. A prop with no story is undocumented and untested — the story suite should visually cover every prop a component accepts.

## Storybook Story Rules

**Component-level stories** (`src/components/*/ComponentName.stories.tsx`):

- Test the component in isolation only
- Do not import or render other fui-components inside these stories
- Use plain HTML elements (e.g. `<div className="...">`) for any necessary layout or background wrappers

**Showcase stories** (`src/stories/*/ComponentNameShowcase.stories.tsx`):

- Advanced, composed scenarios showing how components work together
- May combine multiple fui-components freely
- Use `TransparentPanel`, `Typography`, and other components as needed for realistic context
