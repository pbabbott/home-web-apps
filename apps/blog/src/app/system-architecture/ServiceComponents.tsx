'use client';
import { useState } from 'react';
import {
  Button,
  DiagramViewer,
  type ButtonColor,
  type DiagramViewerProps,
} from '@abbottland/fui-components';
import { Icon, renderSimpleIcon } from '@abbottland/fui-icons';
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
}[] = [
  {
    id: 'istio',
    label: 'Istio Service Mesh',
    iconId: 'istio',
    color: 'accent-falcon',
    data: istioData as DiagramViewerProps['data'],
  },
  {
    id: 'public-ingress',
    label: 'Public Ingress Pattern',
    iconId: 'radix-paper-plane',
    color: 'accent-falcon',
    data: publicIngressData as DiagramViewerProps['data'],
  },
  {
    id: 'lan-ingress',
    label: 'LAN Ingress Pattern',
    iconId: 'radix-paper-plane',
    color: 'accent-falcon',
    data: lanIngressData as DiagramViewerProps['data'],
  },
  {
    id: 'virtualization',
    label: 'Virtualization',
    iconId: 'radix-card-stack',
    color: 'warning',
    data: virtualizationData as DiagramViewerProps['data'],
  },
  {
    id: 'storage',
    label: 'Storage',
    iconId: 'cylinder',
    color: 'warning',
    data: storageData as DiagramViewerProps['data'],
  },
  {
    id: 'developer-experience',
    label: 'Developer Experience',
    iconId: 'radix-code',
    color: 'warning',
    data: developerExperienceData as DiagramViewerProps['data'],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    iconId: 'radix-eye-open',
    color: 'secondary',
    data: monitoringData as DiagramViewerProps['data'],
  },
  {
    id: 'media-stack',
    label: 'Media Stack',
    iconId: 'radix-mixer',
    color: 'primary',
    data: mediaStackData as DiagramViewerProps['data'],
  },
  {
    id: 'custom-app-pipeline',
    label: 'Custom Application Deployment Pipeline',
    iconId: 'radix-code',
    color: 'accent-purple',
    data: customAppPipelineData as DiagramViewerProps['data'],
  },
  {
    id: 'gitops-pipeline',
    label: 'GitOps Deployment Pipeline',
    iconId: 'radix-upload',
    color: 'accent-purple',
    data: gitopsPipelineData as DiagramViewerProps['data'],
  },
];

// Mirrors Button's outlined-variant hover fill per color, applied statically
// to the selected button instead of only on hover.
const selectedClass: Record<ButtonColor, string> = {
  primary: 'bg-primary-500 text-black',
  secondary: 'bg-secondary-500 text-neutral-50',
  success: 'bg-success-400 text-neutral-50',
  error: 'bg-error-400 text-neutral-50',
  warning: 'bg-warning-400 text-neutral-50',
  'accent-purple': 'bg-accent-purple-300 text-neutral-50',
  'accent-falcon': 'bg-accent-falcon-400 text-neutral-50',
  neutral: 'bg-neutral-700 text-neutral-50',
};

export function ServiceComponents() {
  const [selectedId, setSelectedId] = useState(components[0].id);
  const selected = components.find((c) => c.id === selectedId) ?? components[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {components.map((component) => (
          <Button
            key={component.id}
            variant="outlined"
            color={component.color}
            onClick={() => setSelectedId(component.id)}
            className={
              component.id === selectedId
                ? `${selectedClass[component.color]} shadow-sm`
                : ''
            }
          >
            <span className="flex items-center gap-2">
              <Icon name={component.iconId} size={16} className="shrink-0" />
              {component.label}
            </span>
          </Button>
        ))}
      </div>

      <DiagramViewer
        key={selected.id}
        data={selected.data}
        height="500px"
        renderIcon={renderSimpleIcon}
      />
    </div>
  );
}
