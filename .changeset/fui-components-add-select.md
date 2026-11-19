---
'@abbottland/fui-components': minor
---

Add a `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` component built on `@radix-ui/react-select`. Its menu shares DropdownMenu's styling (corner brackets, clip reveal, item flash). `DropdownMenuContent` and `SelectContent` gain a `container` prop, `DropdownMenuItem` gets disabled styling, and an unlabelled `DropdownMenuContent` now pads its first item down level with the corner brackets.

The repo now pins a single `@radix-ui/react-dismissable-layer` (root `pnpm.overrides`). Previously `Modal`, `DropdownMenu` and `Select` pulled in three different versions, each with its own layer stack, so pressing Escape in a menu opened inside a `Modal` closed both. Now it closes only the menu.
