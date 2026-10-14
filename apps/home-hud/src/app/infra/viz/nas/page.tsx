import { Suspense } from 'react';
import { NasViewerClient } from './NasViewerClient';

export const metadata = {
  title: 'NAS 3D Viewer | Home HUD',
};

/**
 * Dev route for the procedural ASUSTOR NAS model, kept separate from
 * /infra/hosts until the viewer is ready to replace that page's "No image
 * yet" placeholder. Supports `?angle=<front|rear|left|right|top|bottom|
 * threeQuarter>` to set the starting camera and `?ref=<angle>` to overlay
 * the matching reference photo (see models/nas/REFERENCES.md).
 *
 * No fui-components import here — this is a Server Component, and (per
 * hosts/page.tsx's convention) only *Client.tsx files reach into
 * fui-components.
 */
export default function NasViewerPage() {
  return (
    <Suspense fallback={null}>
      <NasViewerClient />
    </Suspense>
  );
}
