import { Suspense } from 'react';
import { VizViewerClient } from './VizViewerClient';

export const metadata = {
  title: '3D Model Viewer | Home HUD',
};

/**
 * Shared dev route for every procedural 3D model in the collection —
 * replaces the old one-route-per-model pattern (`viz/<slug>/page.tsx`).
 * `?model=<slug>` picks which model's tab is active (defaults to the
 * first `MODEL_REGISTRY` entry); `?angle=<name>` and `?ref=<name>` are
 * still per-model, parsed inside each model's own `<Model>Panel.tsx`.
 *
 * No fui-components import here — this is a Server Component, and (per
 * hosts/page.tsx's convention) only `*Client.tsx` files reach into
 * fui-components.
 */
export default function VizViewerPage() {
  return (
    <Suspense fallback={null}>
      <VizViewerClient />
    </Suspense>
  );
}
