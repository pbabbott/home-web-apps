'use client';

import dynamic from 'next/dynamic';
import { SimpleModelPanel } from '../components/SimpleModelPanel';
import { PIRONMAN4_CONFIG } from '../models/pironman4/config';

const Pironman4Scene = dynamic(() => import('./Pironman4Scene'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950" aria-hidden />,
});

/** The Pironman4 viewer's inner content, rendered inside a `<TabsContent>` by `../VizViewerClient.tsx`. */
export function Pironman4Panel() {
  return (
    <SimpleModelPanel
      Scene={Pironman4Scene}
      defaultEdgeColor={PIRONMAN4_CONFIG.materials.edgeHighlight}
      photoSlug="pironman4"
    />
  );
}
