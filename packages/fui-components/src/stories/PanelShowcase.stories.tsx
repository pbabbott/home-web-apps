import { Panel } from '../components/Panel/Panel';
import { type ReactNode } from 'react';
import type { StoryObj } from '@storybook/react-vite';
import type { PanelVariant } from '../components/Panel/types';

const PanelContent = ({ children }: { children: ReactNode }) => {
  return <div className="text-body2 px-2 py-16">{children}</div>;
};

const meta = {
  title: 'Showcase/Panel',
};

export default meta;
type Story = StoryObj<typeof meta>;

// Function to render all colors in a grid for a given variant
const renderColorGrid = (variant: PanelVariant) => (
  <div className="grid grid-cols-3 gap-6">
    <Panel color="default" variant={variant}>
      <PanelContent>Default</PanelContent>
    </Panel>
    <Panel color="white" variant={variant}>
      <PanelContent>White</PanelContent>
    </Panel>
    <Panel color="primary" variant={variant}>
      <PanelContent>Primary</PanelContent>
    </Panel>
    <Panel color="secondary" variant={variant}>
      <PanelContent>Secondary</PanelContent>
    </Panel>
    <Panel color="success" variant={variant}>
      <PanelContent>Success</PanelContent>
    </Panel>
    <Panel color="error" variant={variant}>
      <PanelContent>Error</PanelContent>
    </Panel>
    <Panel color="warning" variant={variant}>
      <PanelContent>Warning</PanelContent>
    </Panel>
    <Panel color="accent-purple" variant={variant}>
      <PanelContent>Purple</PanelContent>
    </Panel>
    <Panel color="accent-falcon" variant={variant}>
      <PanelContent>Falcon</PanelContent>
    </Panel>
  </div>
);

// Example showing all colors in a grid
export const TransparentColors: Story = {
  render: () => renderColorGrid('transparent'),
};

export const OutlinedColors: Story = {
  render: () => renderColorGrid('outlined'),
};

export const DotsColors: Story = {
  render: () => renderColorGrid('dots'),
};
