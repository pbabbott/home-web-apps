# CLAUDE.md — packages/fui-components

## Typography

Always use the `Typography` component for all rendered text — no raw `<p>`, `<span>`, `<h*>`, or other HTML text elements. This applies to components and stories alike.

## Storybook Story Rules

**Component-level stories** (`src/components/*/ComponentName.stories.tsx`):

- Test the component in isolation only
- Do not import or render other fui-components inside these stories
- Use plain HTML elements (e.g. `<div className="...">`) for any necessary layout or background wrappers

**Showcase stories** (`src/stories/*/ComponentNameShowcase.stories.tsx`):

- Advanced, composed scenarios showing how components work together
- May combine multiple fui-components freely
- Use `TransparentPanel`, `Typography`, and other components as needed for realistic context
