import { TransparentPanel } from '../../components/TransparentPanel/TransparentPanel';
import { type ReactNode } from 'react';
import type { StoryObj } from '@storybook/react-vite';

const PanelContent = ({ children }: { children: ReactNode }) => {
  return <div className="text-body2 px-2 py-16">{children}</div>;
};

const meta = {
  title: 'Showcase/TransparentPanel',
};

export default meta;
type Story = StoryObj<typeof meta>;

// Function to render all colors in a grid
const renderColorGrid = () => (
  <div className="grid grid-cols-4 gap-6">
    <TransparentPanel color="default">
      <PanelContent>Default</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="dark">
      <PanelContent>Dark</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="white">
      <PanelContent>White</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="primary">
      <PanelContent>Primary</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="secondary">
      <PanelContent>Secondary</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="success">
      <PanelContent>Success</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="error">
      <PanelContent>Error</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="warning">
      <PanelContent>Warning</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="accent-purple">
      <PanelContent>Purple</PanelContent>
    </TransparentPanel>
    <TransparentPanel color="accent-falcon">
      <PanelContent>Falcon</PanelContent>
    </TransparentPanel>
  </div>
);

// Example showing all colors in a grid
export const AllColors: Story = {
  render: () => renderColorGrid(),
};
