---
'@abbottland/fui-components': minor
---

Add a `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` component built on `@radix-ui/react-select`. Its menu shares DropdownMenu's styling (corner brackets, clip reveal, item flash). `DropdownMenuContent` and `SelectContent` gain a `container` prop, `DropdownMenuItem` gets disabled styling, and an unlabelled `DropdownMenuContent` now pads its first item down level with the corner brackets.

Within this repo, a root `pnpm.overrides` entry pins a single `@radix-ui/react-dismissable-layer`. Previously `Modal`, `DropdownMenu` and `Select` pulled in three different versions, each with its own layer stack, so pressing Escape in a menu opened inside a `Modal` closed both. Now it closes only the menu. The override only applies to this workspace: apps that consume the published package should also dedupe `@radix-ui/react-dismissable-layer` (e.g. their own `pnpm.overrides` / `resolutions`) to get the same behaviour.
