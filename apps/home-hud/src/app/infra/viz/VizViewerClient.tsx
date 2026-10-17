'use client';

import { useEffect, type ComponentType } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Typography,
} from '@abbottland/fui-components';
import { BeelinkSer5Panel } from './beelink-ser5/BeelinkSer5Panel';
import { MODEL_REGISTRY, isKnownModelSlug } from './models/registry';
import { NasPanel } from './nas/NasPanel';
import { Pironman4Panel } from './pironman4/Pironman4Panel';

/** Panel per `MODEL_REGISTRY` slug — add an entry here alongside the registry entry. */
const PANELS: Record<string, ComponentType> = {
  nas: NasPanel,
  pironman4: Pironman4Panel,
  'beelink-ser5': BeelinkSer5Panel,
};

/**
 * Owns the shared `<main>`/H1/tab row for every model in `MODEL_REGISTRY`
 * — one route (`/infra/viz?model=<slug>`) instead of a route per model.
 * Tab selection lives in the `?model=` query param (not local state) so
 * it's deep-linkable and the capture scripts can target a specific model
 * directly. Switching tabs preserves any existing `?angle=`/`?ref=` —
 * those are still read independently by each model's own `<Model>Panel`.
 * Radix's `TabsContent` only renders the active panel to the DOM, so only
 * the active model's R3F/WebGL Scene ever mounts.
 */
export function VizViewerClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const modelParam = searchParams.get('model');
  const activeSlug = isKnownModelSlug(modelParam)
    ? (modelParam as string)
    : MODEL_REGISTRY[0].slug;
  const activeEntry =
    MODEL_REGISTRY.find((entry) => entry.slug === activeSlug) ??
    MODEL_REGISTRY[0];

  useEffect(() => {
    document.title = `${activeEntry.label} 3D Viewer | Home HUD`;
  }, [activeEntry.label]);

  function handleModelChange(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('model', slug);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <main className="flex flex-col gap-4 p-6">
      <Typography variant="h1">{activeEntry.label} 3D Viewer</Typography>
      <Tabs value={activeSlug} onValueChange={handleModelChange}>
        <TabsList>
          {MODEL_REGISTRY.map((entry) => (
            <TabsTrigger key={entry.slug} value={entry.slug}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {MODEL_REGISTRY.map((entry) => (
          <TabsContent key={entry.slug} value={entry.slug} className="pt-4">
            {(() => {
              const ModelPanel = PANELS[entry.slug];
              return ModelPanel ? <ModelPanel /> : null;
            })()}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
