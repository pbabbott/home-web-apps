'use client';
import { useRef, useState } from 'react';
import {
  OutlinedButton,
  DiagramViewer,
  CautionTape,
  Typography,
  type ButtonColor,
  type DiagramViewerProps,
} from '@abbottland/fui-components';
import { Icon, renderSimpleIcon } from '@abbottland/fui-icons';
import MaskReveal from '@/components/MaskReveal/MaskReveal';
import {
  SelectionConnector,
  DIAGRAM_LEFT_PADDING,
  getConnectorPalette,
} from './SelectionConnector';
import lanIngressData from './diagram-c3-lan-ingress.json';
import publicIngressData from './diagram-c3-public-ingress.json';
import developerExperienceData from './diagram-c3-developer-experience.json';
import virtualizationData from './diagram-c3-virtualization.json';
import storageData from './diagram-c3-storage.json';
import monitoringData from './diagram-c3-monitoring.json';
import mediaStackData from './diagram-c3-media-stack.json';
import customAppPipelineData from './diagram-c3-custom-app-pipeline.json';
import gitopsPipelineData from './diagram-c3-gitops-pipeline.json';
import istioData from './diagram-c3-istio.json';

const components: {
  id: string;
  label: string;
  iconId: string;
  color: ButtonColor;
  data: DiagramViewerProps['data'];
  isComplete: boolean;
}[] = [
  {
    id: 'public-ingress',
    label: 'Public Ingress Pattern',
    iconId: 'radix-paper-plane',
    color: 'accent-falcon',
    data: publicIngressData as DiagramViewerProps['data'],
    isComplete: publicIngressData.isComplete === true,
  },
  {
    id: 'lan-ingress',
    label: 'LAN Ingress Pattern',
    iconId: 'radix-paper-plane',
    color: 'accent-falcon',
    data: lanIngressData as DiagramViewerProps['data'],
    isComplete: lanIngressData.isComplete === true,
  },
  {
    id: 'istio',
    label: 'Istio Service Mesh',
    iconId: 'istio',
    color: 'accent-falcon',
    data: istioData as DiagramViewerProps['data'],
    isComplete: istioData.isComplete === true,
  },
  {
    id: 'virtualization',
    label: 'Virtualization',
    iconId: 'radix-card-stack',
    color: 'warning',
    data: virtualizationData as DiagramViewerProps['data'],
    isComplete: virtualizationData.isComplete === true,
  },
  {
    id: 'storage',
    label: 'Storage',
    iconId: 'cylinder',
    color: 'warning',
    data: storageData as DiagramViewerProps['data'],
    isComplete: storageData.isComplete === true,
  },
  {
    id: 'developer-experience',
    label: 'Developer Experience',
    iconId: 'radix-code',
    color: 'warning',
    data: developerExperienceData as DiagramViewerProps['data'],
    isComplete: developerExperienceData.isComplete === true,
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    iconId: 'radix-eye-open',
    color: 'secondary',
    data: monitoringData as DiagramViewerProps['data'],
    isComplete: monitoringData.isComplete === true,
  },
  {
    id: 'media-stack',
    label: 'Media Stack',
    iconId: 'radix-mixer',
    color: 'primary',
    data: mediaStackData as DiagramViewerProps['data'],
    isComplete: mediaStackData.isComplete === true,
  },
  {
    id: 'custom-app-pipeline',
    label: 'Custom Application Deployment Pipeline',
    iconId: 'radix-code',
    color: 'accent-purple',
    data: customAppPipelineData as DiagramViewerProps['data'],
    isComplete: customAppPipelineData.isComplete === true,
  },
  {
    id: 'gitops-pipeline',
    label: 'GitOps Deployment Pipeline',
    iconId: 'radix-upload',
    color: 'accent-purple',
    data: gitopsPipelineData as DiagramViewerProps['data'],
    isComplete: gitopsPipelineData.isComplete === true,
  },
];

export function ServiceComponents() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = components.find((c) => c.id === selectedId);
  const selectedPalette = selected && getConnectorPalette(selected.color);

  // Decoupled from selectedId: the diagram only swaps to match the
  // selection once the connector's spark has actually arrived (see the
  // sequencing comment below), not the instant a button is clicked.
  const [displayedId, setDisplayedId] = useState<string | null>(null);
  const displayed = components.find((c) => c.id === displayedId);

  // maskGeneration: bumped on click to remount MaskReveal in its closed
  // state immediately, covering the *current* diagram right away.
  // revealTrigger: flipped true once the spark arrives, opening that same
  // (already-mounted-since-click) MaskReveal instance over the *new* diagram.
  const [maskGeneration, setMaskGeneration] = useState(0);
  const [revealTrigger, setRevealTrigger] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const entryRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleSelect = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setMaskGeneration((g) => g + 1);
    setRevealTrigger(false);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-4">
      <Typography
        variant="caption"
        component="p"
        className="text-neutral-500"
        style={{ paddingLeft: DIAGRAM_LEFT_PADDING }}
      >
        Buttons correspond to C2 patterns above :: select one to resolve its C3
        detail below.
      </Typography>
      <div
        className="flex flex-wrap gap-2"
        style={{ paddingLeft: DIAGRAM_LEFT_PADDING }}
      >
        {components.map((component) => (
          <OutlinedButton
            key={component.id}
            ref={(el: HTMLButtonElement | null) => {
              if (el) buttonRefs.current.set(component.id, el);
              else buttonRefs.current.delete(component.id);
            }}
            color={component.color}
            // size is a fixed JS prop, not a responsive Tailwind class, so the
            // "default" size for tablet+ is applied as a literal sm: override
            // here — same pattern as the h1 mobile-scaling fix elsewhere on
            // this page (mirrors buttonSizeClasses.default in fui-components).
            size="small"
            selected={component.id === selectedId}
            onClick={() => handleSelect(component.id)}
            className={`sm:px-4 sm:py-2 sm:text-button ${component.id === selectedId ? 'shadow-sm' : ''}`}
          >
            <span className="flex items-center gap-2">
              <Icon name={component.iconId} size={16} className="shrink-0" />
              {component.label}
            </span>
          </OutlinedButton>
        ))}
      </div>

      <div ref={entryRef} style={{ paddingLeft: DIAGRAM_LEFT_PADDING }}>
        {displayed ? (
          <MaskReveal
            key={maskGeneration}
            reveal={revealTrigger}
            animated={maskGeneration > 0}
            direction="left-to-right"
            duration={500}
            maskClassName="bg-neutral-950"
            edgeColor={selectedPalette?.hex}
          >
            {displayed.isComplete ? (
              <DiagramViewer
                key={displayed.id}
                data={displayed.data}
                height="500px"
                className={selectedPalette?.borderClass}
                renderIcon={renderSimpleIcon}
              />
            ) : (
              <div
                key={displayed.id}
                className={`relative w-full overflow-hidden border bg-neutral-900 ${selectedPalette?.borderClass ?? ''}`}
                style={{ height: '500px' }}
              >
                <CautionTape label="UNDER CONSTRUCTION" />
              </div>
            )}
          </MaskReveal>
        ) : (
          <div
            className="relative w-full overflow-hidden border border-neutral-700 bg-neutral-900 flex items-center justify-center"
            style={{ height: '500px' }}
          >
            <Typography
              variant="body1"
              component="p"
              className="text-neutral-500 text-center px-8"
            >
              Select a pattern above to resolve its component-level detail.
            </Typography>
          </div>
        )}
      </div>

      {selectedId && selected && (
        <SelectionConnector
          containerRef={containerRef}
          buttonRefs={buttonRefs}
          entryRef={entryRef}
          selectedId={selectedId}
          color={selected.color}
          // Sequencing: 1. click covers the mask immediately (maskGeneration
          // bump, revealTrigger false)  2. spark plays  3. spark arrives  4.
          // diagram content swaps and the same mask instance opens over it.
          onArrive={() => {
            setDisplayedId(selectedId);
            setRevealTrigger(true);
          }}
        />
      )}
    </div>
  );
}
