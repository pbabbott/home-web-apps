import { DotGridPanel } from '../../components/DotGridPanel/DotGridPanel';
import { type ReactNode } from 'react';
import type { StoryObj } from '@storybook/react-vite';

const PanelContent = ({ children }: { children: ReactNode }) => {
  return <div className="text-body2 px-2 py-16">{children}</div>;
};

const meta = {
  title: 'Showcase/DotGridPanel',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllColors: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6">
      <DotGridPanel color="default">
        <PanelContent>Default</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="white">
        <PanelContent>White</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="primary">
        <PanelContent>Primary</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="secondary">
        <PanelContent>Secondary</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="success">
        <PanelContent>Success</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="error">
        <PanelContent>Error</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="warning">
        <PanelContent>Warning</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="accent-purple">
        <PanelContent>Purple</PanelContent>
      </DotGridPanel>
      <DotGridPanel color="accent-falcon">
        <PanelContent>Falcon</PanelContent>
      </DotGridPanel>
    </div>
  ),
};

