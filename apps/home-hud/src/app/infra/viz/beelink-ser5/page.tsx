import { Suspense } from 'react';
import { BeelinkSer5ViewerClient } from './BeelinkSer5ViewerClient';

export const metadata = {
  title: 'Beelink SER5 3D Viewer | Home HUD',
};

/**
 * Dev route for the procedural Beelink SER5 model — mirrors
 * /infra/viz/pironman4/page.tsx. No fui-components import here (Server
 * Component convention, see hosts/page.tsx).
 */
export default function BeelinkSer5ViewerPage() {
  return (
    <Suspense fallback={null}>
      <BeelinkSer5ViewerClient />
    </Suspense>
  );
}
