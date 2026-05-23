# blog

## 0.5.0

### Minor Changes

- Add Directory dropdown navigation with new pages and extended DropdownMenuItem
  - StickyHeader: toggle CardStackPlusIcon/CardStackMinusIcon based on dropdown open state
  - StickyHeader: Series item (SectionIcon) navigates to /series page
  - StickyHeader: System Architecture item (LayersIcon) navigates to /system-architecture page
  - StickyHeader: FUI Components item navigates to fui-components.abbottland.io in new tab with OpenInNewWindowIcon
  - DropdownMenuItem: add rightIcon prop for right-side icon slot
  - Add /series and /system-architecture placeholder pages
  - Set bg-neutral-800 as default site background

### Patch Changes

- Updated dependencies []:
  - @abbottland/fui-components@0.6.0

## 0.4.1

### Patch Changes

- Fix homepage animations always disabled due to hardcoded `animationsEnabled: false` in HomeContextProvider

## 0.4.0

### Minor Changes

- Add FooterSection with blog CTA, GitHub/LinkedIn social links, and live package version
- Rewrite WelcomeSection copy: ethos, voice corrections, levity, no em-dashes
- Fix LandingSection button height mismatch by using Button `component` prop instead of Link wrapper
- Decompose BlogPageClient into BlogPageContextProvider, BlogBackground, BlogFilters, BlogFeed
- Reorganize blog route into `_components/`, `_lib/`, `_hooks/` folders
- Fix landing section height: `h-screen` to `h-dvh` for mobile viewport correctness
- Apply `--header-height` CSS variable to blog page top padding

- Updated dependencies:
  - @abbottland/fui-components@0.5.0

## 0.2.5

### Patch Changes

- Fix production TypeErrors caused by fui-components dist built with jsxDEV (development JSX runtime). Lock build:npm to NODE_ENV=production so Vite always emits jsx/jsxs instead of jsxDEV.

- Updated dependencies []:
  - @abbottland/fui-components@0.4.4

## 0.2.4

### Patch Changes

- Updated dependencies []:
  - @abbottland/fui-components@0.4.3

## 0.2.3

### Patch Changes

- Updated dependencies []:
  - @abbottland/fui-components@0.4.2

## 0.2.2

### Patch Changes

- Updated dependencies []:
  - @abbottland/fui-components@0.4.1

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @abbottland/fui-components@0.4.0

## 0.2.0

### Minor Changes

- Upgrade storybook to v10 and integrate with new blog site

### Patch Changes

- Updated dependencies []:
  - fui-components@0.1.0
