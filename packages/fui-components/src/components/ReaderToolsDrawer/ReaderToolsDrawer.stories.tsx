import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  ReaderToolsDrawer,
  type ReaderToolsDrawerProps,
} from './ReaderToolsDrawer';

const meta = {
  title: 'Components/ReaderToolsDrawer',
  component: ReaderToolsDrawer,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Panel heading and handle accessible name',
    },
    animated: {
      control: 'boolean',
      description: 'Slide transition vs instant (reduced motion)',
    },
  },
  args: {
    title: 'Reader Tools',
    animated: true,
  },
  decorators: [
    (Story) => (
      <div className="relative h-screen w-full bg-neutral-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReaderToolsDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

// Plain HTML stand-in for the "Highlight AI Generated Text" toggle row — the
// real row (label + Switch) is composed downstream, since component-level
// stories here must stay in isolation from other fui-components.
function ExampleToolRow({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-200">
        Highlight AI Generated Text
      </span>
      <input type="checkbox" defaultChecked={defaultChecked} />
    </label>
  );
}

const DrawerStory = (args: ReaderToolsDrawerProps, initialOpen: boolean) => {
  const Render = (renderArgs: ReaderToolsDrawerProps) => {
    const [open, setOpen] = useState(initialOpen);
    return (
      <ReaderToolsDrawer {...renderArgs} open={open} onOpenChange={setOpen}>
        <ExampleToolRow defaultChecked={initialOpen} />
      </ReaderToolsDrawer>
    );
  };
  return { args, render: Render };
};

export const Closed: Story = DrawerStory({} as ReaderToolsDrawerProps, false);
export const Open: Story = DrawerStory({} as ReaderToolsDrawerProps, true);
