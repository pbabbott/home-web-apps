import * as Tabs from '@radix-ui/react-tabs';
import {
  DiagramViewer,
  Typography,
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

const tabs: {
  id: string;
  label: string;
  iconId: string;
  data: DiagramViewerProps['data'];
}[] = [
  {
    id: 'lan-ingress',
    label: 'LAN Ingress Pattern',
    iconId: 'radix-paper-plane',
    data: lanIngressData as DiagramViewerProps['data'],
  },
  {
    id: 'public-ingress',
    label: 'Public Ingress Pattern',
    iconId: 'radix-paper-plane',
    data: publicIngressData as DiagramViewerProps['data'],
  },
  {
    id: 'developer-experience',
    label: 'Developer Experience',
    iconId: 'radix-code',
    data: developerExperienceData as DiagramViewerProps['data'],
  },
  {
    id: 'virtualization',
    label: 'Virtualization',
    iconId: 'radix-card-stack',
    data: virtualizationData as DiagramViewerProps['data'],
  },
  {
    id: 'storage',
    label: 'Storage',
    iconId: 'cylinder',
    data: storageData as DiagramViewerProps['data'],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    iconId: 'radix-eye-open',
    data: monitoringData as DiagramViewerProps['data'],
  },
  {
    id: 'media-stack',
    label: 'Media Stack',
    iconId: 'radix-mixer',
    data: mediaStackData as DiagramViewerProps['data'],
  },
  {
    id: 'custom-app-pipeline',
    label: 'Custom Application Deployment Pipeline',
    iconId: 'radix-code',
    data: customAppPipelineData as DiagramViewerProps['data'],
  },
  {
    id: 'gitops-pipeline',
    label: 'GitOps Deployment Pipeline',
    iconId: 'radix-upload',
    data: gitopsPipelineData as DiagramViewerProps['data'],
  },
];

const triggerClass =
  'px-3 py-2 text-left cursor-pointer transition-colors hover:bg-neutral-700/50 data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm leading-none';

export function ServiceComponentsTabs() {
  return (
    <Tabs.Root
      defaultValue={tabs[0].id}
      orientation="vertical"
      className="flex border border-neutral-700"
    >
      <Tabs.List className="flex w-44 flex-col border-r border-neutral-700 bg-neutral-800/40 p-2 gap-0.5 shrink-0">
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.id} value={tab.id} className={triggerClass}>
            <span className="flex items-center gap-2">
              <Icon name={tab.iconId} size={16} className="shrink-0" />
              <Typography variant="body2" component="span">
                {tab.label}
              </Typography>
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <div className="flex-1 min-w-0 flex flex-col">
        {tabs.map((tab) => (
          <Tabs.Content key={tab.id} value={tab.id} className="flex-1 min-h-0">
            <DiagramViewer
              data={tab.data}
              height="100%"
              className="min-h-[400px]"
              renderIcon={renderSimpleIcon}
            />
          </Tabs.Content>
        ))}
      </div>
    </Tabs.Root>
  );
}
