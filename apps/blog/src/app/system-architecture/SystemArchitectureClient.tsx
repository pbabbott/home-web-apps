'use client';
import StickyHeader from '@/components/StickyHeader/StickyHeader';
import PageScrollLayout from '@/components/PageScrollLayout/PageScrollLayout';
import {
  Typography,
  type DiagramViewerProps,
} from '@abbottland/fui-components';
import { DiagramViewer } from '@/components/diagram';
import ProgressiveTerminal, {
  type TerminalLine,
} from '@/components/ProgressiveTerminal/ProgressiveTerminal';
import Footer from '@/components/Footer/Footer';
import { useAnimationsContext } from '@/context/Animations.Context';
import {
  ArchSectionHeader,
  type ArchSectionHeaderProps,
} from './ArchSectionHeader';
import { ServiceComponentsSection } from './ServiceComponentsSection';
import diagram01 from './diagram-01.json';
import diagram02 from './diagram-02.json';

const emptyDiagram = { nodes: [], edges: [] };

const introLines: TerminalLine[] = [
  {
    text: 'Initializing self-inspection routine... ',
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Target system: ',
    endOfLineComponent: <span className="text-neutral-100">abbottland.io</span>,
  },
  {
    text: 'Resolving abstraction levels... ',
    endOfLineComponent: (
      <span className="text-success-500">3 LEVELS FOUND</span>
    ),
  },
  {
    text: 'Generating infrastructure map... ',
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Rendering architecture powering this site... ',
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Advising human to expect increasing complexity... ',
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
];

interface ArchSectionProps extends ArchSectionHeaderProps {
  diagramHeight?: string;
  data?: DiagramViewerProps['data'];
}

function ArchSection({
  diagramHeight = '400px',
  data = emptyDiagram,
  ...headerProps
}: ArchSectionProps) {
  return (
    <section className="mb-20">
      <ArchSectionHeader {...headerProps} />
      <DiagramViewer data={data} height={diagramHeight} />
    </section>
  );
}

export default function SystemArchitectureClient() {
  const { animationsEnabled } = useAnimationsContext();

  return (
    <div className="min-h-screen bg-neutral-900">
      <StickyHeader />
      <PageScrollLayout>
        <main className="pt-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="mb-16">
              <Typography
                variant="h1"
                component="h1"
                className="text-neutral-100 mb-6 text-[2rem] sm:text-h1"
              >
                System Architecture
              </Typography>
              <ProgressiveTerminal
                lines={introLines}
                className="max-w-2xl"
                animated={animationsEnabled}
              />
            </div>

            <ArchSection
              levelLabel="Context Level :: C1"
              heading="System Context"
              description="Highest-order topology. One user device. One residential uplink. One Kubernetes cluster. Scope: everything that matters, nothing that doesn't."
              complexity={{ label: 'Low', color: 'success' }}
              diagramHeight="360px"
              data={diagram01 as DiagramViewerProps['data']}
            />

            <ArchSection
              levelLabel="Container Level :: C2"
              heading="Infrastructure Patterns"
              description="Cluster internals exposed. Ingress controllers, application services, and persistent storage rendered as discrete units. Internal networking partially abstracted."
              complexity={{ label: 'Moderate', color: 'warning' }}
              diagramHeight="480px"
              data={diagram02 as DiagramViewerProps['data']}
            />

            <ServiceComponentsSection />
          </div>
        </main>
        <Footer />
      </PageScrollLayout>
    </div>
  );
}
