# fui-icons — Custom Icon Guide

## Adding a Custom Icon

Custom icons are hand-crafted SVG components used when simple-icons doesn't have the icon needed (e.g. generic concepts like "router", "hard drive", "cylinder").

### Step 1 — Find the SVG

Preferred icon sets (in order):

1. **Lucide** (`lucide.dev`) — ISC license, 24×24, stroke-based, `currentColor`
   - Raw SVG: `https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/<name>.svg`
2. **icon-park-solid / icon-park-outline** (`iconpark.oceanengine.com`) — Apache 2.0, 48×48, fill-based
   - Raw SVG: `https://raw.githubusercontent.com/bytedance/IconPark/master/source/solid/<name>.svg`
3. **dashboard-icons** (`github.com/walkxcode/dashboard-icons`) — MIT, service/app logos

Fetch the raw SVG via `WebFetch` on the raw GitHub URL to get exact path data.

### Step 2 — Add component to `src/customIcons.tsx`

Follow the existing pattern exactly. Match the source set's style:

**Lucide-style** (stroke, currentColor, 24×24):

```tsx
export const MyIcon: FC<SvgIconProps> = ({ size, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* lucide/<icon-name> — ISC license */}
    <path d="..." />
  </svg>
);
```

**icon-park-style** (fill, 48×48):

```tsx
export const MyIcon: FC<SvgIconProps> = ({ size, className }) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* icon-park-solid <icon-name> — Apache 2.0 */}
    <g fill="none">
      <path fill="#..." d="..." />
    </g>
  </svg>
);
```

### Step 3 — Register in `src/customIconsMap.ts`

```ts
import { ..., MyIcon } from './customIcons';

export const CUSTOM_ICONS: Record<string, FC<SvgIconProps>> = {
  // existing entries...
  'my-icon-key': MyIcon,
};
```

Use kebab-case keys. The key is what consumers pass as the icon name.

### Step 4 — Add to `src/registry.ts`

Add an entry to `ICON_REGISTRY` so the icon is discoverable via search/picker:

```ts
{
  id: 'my-icon-key',
  label: 'My Icon',
  slug: 'my-icon-key',
  source: 'custom',
  keywords: ['relevant', 'search', 'terms'],
},
```

Place it in the `// custom icons` section, alphabetically by `id`.

### Step 5 — Build

After any source changes, always run:

```bash
pnpm build:npm
```

Run from `packages/fui-icons` or repo root (Turborepo will scope it). Required to update `dist/` before consumers pick up changes.

### Existing custom icons

| Key          | Component       | Source                       |
| ------------ | --------------- | ---------------------------- |
| `banana`     | `BananaIcon`    | icon-park-solid — Apache 2.0 |
| `cylinder`   | `CylinderIcon`  | lucide/database — ISC        |
| `duckdns`    | `DuckDnsIcon`   | dashboard-icons — MIT        |
| `folder`     | `FolderIcon`    | lucide/folder — ISC          |
| `haproxy`    | `HaproxyIcon`   | hand-crafted                 |
| `hard-drive` | `HardDriveIcon` | lucide/hard-drive — ISC      |
| `router`     | `RouterIcon`    | icon-park-solid — Apache 2.0 |
