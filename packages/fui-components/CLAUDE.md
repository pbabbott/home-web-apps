# CLAUDE.md — packages/fui-components

## Architecture

- Built as a library with **Vite** (`build:npm`) and exported as ESM/CJS
- **Storybook 10** for development and documentation
- **Playwright** for screenshot regression tests; **Vitest** for DOM unit tests
- Test stories are auto-generated via `test:playwright:generate`

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
