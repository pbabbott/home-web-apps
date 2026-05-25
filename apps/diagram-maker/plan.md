A good architecture is:

store only an icon identifier in diagram JSON,
keep icon rendering outside the serialized data,
lazy-load icons at the application layer,
and treat icons as a registry/plugin system.

That avoids:

shipping all icons inside fui-components,
coupling your shared package to simple-icons,
and bloating bundle size in apps/blog.

A clean approach:

# Recommended Architecture

## 1. Store only icon IDs in diagram JSON

Example node:

```json
{
  "id": "node-1",
  "type": "service",
  "data": {
    "label": "API Gateway",
    "icon": "docker"
  }
}
```

Never store SVG markup in the JSON.

## 2. fui-components should be icon-provider agnostic

Inside packages/fui-components:

```ts
export type IconRenderer = (iconId: string) => React.ReactNode;
```

Diagram component:

```ts
type DiagramProps = {
  renderIcon?: (iconId: string) => React.ReactNode;
};
```

Node renderer:

```ts
{
  data.icon && renderIcon?.(data.icon);
}
```

This is the key design decision.

Your shared library should NOT know:

- react-icons
- simple-icons
- lucide
- mdi
- etc.

It just asks:

“Given docker, render something.”

## 3. Apps provide the actual icon registry

In apps/blog:

```ts
import { SiDocker, SiReact, SiKubernetes } from 'react-icons/si';

const icons = {
  docker: SiDocker,
  react: SiReact,
  kubernetes: SiKubernetes,
};
```

Renderer:

```ts
function renderIcon(iconId: string) {
  const Icon = icons[iconId];

  if (!Icon) return null;

  return <Icon className="w-4 h-4" />;
}
```

Then:

```ts
<DiagramViewer renderIcon={renderIcon} />
```

## 4. Diagram editor uses the same registry

Your editor can expose:

```ts
type AvailableIcon = {
  id: string;
  label: string;
  keywords?: string[];
};
```

Then searchable palette UI:

```ts
[
  { id: 'docker', label: 'Docker' },
  { id: 'react', label: 'React' },
  { id: 'kubernetes', label: 'Kubernetes' },
];
```

User selects one → JSON stores "docker".

## 5. Lazy-load icons for scalability

If your icon catalog grows large, use dynamic imports.

Example:

```ts
const iconLoaders = {
  docker: () => import('react-icons/si').then((m) => m.SiDocker),
  react: () => import('react-icons/si').then((m) => m.SiReact),
};
```

Then:

```ts
const Icon = React.lazy(iconLoaders[iconId]);
```

This prevents huge icon bundles.

6. Best practice: define your own stable icon IDs

Do NOT use component names like:

- SiDocker
- SiReact

Use:

- docker
- react
- kubernetes

This decouples persisted JSON from implementation details.

You can later switch:

from react-icons → simple-icons
or SVG sprites
or custom branded icons

…without migrating stored diagrams.

# A new package: `packages/fui-icons`

Contains:

- stable icon IDs
- icon metadata
- rendering helpers
- optional lazy loaders
- category/tag data

Example:

` packages/ fui-components/ fui-icons/ apps/ blog/ diagram-maker/`
Shared Registry Pattern
Shared icon definition

```ts
export type FuiIconDefinition = {
  id: string;
  label: string;
  keywords?: string[];
  component: React.ComponentType<any>;
};
```
