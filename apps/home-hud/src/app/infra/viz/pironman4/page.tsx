import { Suspense } from 'react';
import { Pironman4ViewerClient } from './Pironman4ViewerClient';

export const metadata = {
  title: 'Pironman4 3D Viewer | Home HUD',
};

/**
 * Dev route for the procedural Pironman4 case model — mirrors
 * /infra/viz/nas/page.tsx. No fui-components import here (Server
 * Component convention, see hosts/page.tsx).
 */
export default function Pironman4ViewerPage() {
  return (
    <Suspense fallback={null}>
      <Pironman4ViewerClient />
    </Suspense>
  );
}
