import { Panel } from '../../components/Panel/Panel';
import { type ReactNode } from 'react';
import type { StoryObj } from '@storybook/react-vite';

const PanelContent = ({ children }: { children: ReactNode }) => {
  return <div className="text-body2 px-2 py-16">{children}</div>;
};

const meta = {
  title: 'Showcase/Panel',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllColors: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6">
      <Panel color="default">
        <PanelContent>Default</PanelContent>
      </Panel>
      <Panel color="white">
        <PanelContent>White</PanelContent>
      </Panel>
      <Panel color="primary">
        <PanelContent>Primary</PanelContent>
      </Panel>
      <Panel color="secondary">
        <PanelContent>Secondary</PanelContent>
      </Panel>
      <Panel color="success">
        <PanelContent>Success</PanelContent>
      </Panel>
      <Panel color="error">
        <PanelContent>Error</PanelContent>
      </Panel>
      <Panel color="warning">
        <PanelContent>Warning</PanelContent>
      </Panel>
      <Panel color="accent-purple">
        <PanelContent>Purple</PanelContent>
      </Panel>
      <Panel color="accent-falcon">
        <PanelContent>Falcon</PanelContent>
      </Panel>
    </div>
  ),
};
