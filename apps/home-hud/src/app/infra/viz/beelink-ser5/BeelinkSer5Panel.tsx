'use client';

import dynamic from 'next/dynamic';
import { SimpleModelPanel } from '../components/SimpleModelPanel';
import { BEELINK_SER5_CONFIG } from '../models/beelink-ser5/config';

const BeelinkSer5Scene = dynamic(() => import('./BeelinkSer5Scene'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950" aria-hidden />,
});

/** The Beelink SER5 viewer's inner content, rendered inside a `<TabsContent>` by `../VizViewerClient.tsx`. */
export function BeelinkSer5Panel() {
  return (
    <SimpleModelPanel
      Scene={BeelinkSer5Scene}
      defaultEdgeColor={BEELINK_SER5_CONFIG.materials.edgeHighlight}
      photoSlug="beelink-ser5"
    />
  );
}
