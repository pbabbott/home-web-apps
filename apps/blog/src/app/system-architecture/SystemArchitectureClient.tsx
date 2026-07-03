'use client';
import StickyHeader from '@/components/StickyHeader/StickyHeader';
import {
  Typography,
  DiagramViewer,
  Badge,
  type DiagramViewerProps,
  type BadgeColor,
} from '@abbottland/fui-components';
import { renderSimpleIcon } from '@abbottland/fui-icons';
import ProgressiveTerminal, {
  type TerminalLine,
} from '@/components/ProgressiveTerminal/ProgressiveTerminal';
import Footer from '@/components/Footer/Footer';
import { ServiceComponents } from './ServiceComponents';
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

interface ComplexityBadgeProps {
  label: string;
  color: BadgeColor;
}

function ComplexityBadge({ label, color }: ComplexityBadgeProps) {
  return <Badge color={color}>Complexity: {label}</Badge>;
}

interface ArchSectionHeaderProps {
  levelLabel: string;
  heading: string;
  description: string;
  complexity: ComplexityBadgeProps;
}

function ArchSectionHeader({
  levelLabel,
  heading,
  description,
  complexity,
}: ArchSectionHeaderProps) {
  return (
    <>
      <Typography variant="h2" component="h2" className="text-neutral-100 mb-2">
        {heading}
      </Typography>
      <div className="flex items-center justify-between gap-4 mb-3">
        <Typography
          variant="caption"
          component="p"
          className="text-neutral-500"
        >
          {levelLabel}
        </Typography>
        <ComplexityBadge {...complexity} />
      </div>
      <Typography
        variant="body1"
        component="p"
        className="text-neutral-400 mb-6 max-w-2xl"
      >
        {description}
      </Typography>
    </>
  );
}

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
      <DiagramViewer
        data={data}
        height={diagramHeight}
        renderIcon={renderSimpleIcon}
      />
    </section>
  );
}

export default function SystemArchitectureClient() {
  return (
    <div className="min-h-screen bg-neutral-900">
      <StickyHeader />
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
              className="max-w-2xl bg-neutral-950"
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

          <section className="mb-20">
            <ArchSectionHeader
              levelLabel="Component Level :: C3"
              heading="Service Components"
              description="Maximum resolution. Individual service components, inter-process communication, and dependency chains fully mapped. Proceed with intent."
              complexity={{ label: 'High', color: 'error' }}
            />
            <ServiceComponents />
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
