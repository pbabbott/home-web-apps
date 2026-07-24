import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { EdgeDrawer, type EdgeDrawerProps } from './EdgeDrawer';

const meta = {
  title: 'Components/EdgeDrawer',
  component: EdgeDrawer,
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
    title: 'Settings',
    animated: true,
  },
  decorators: [
    (Story) => (
      <div className="relative h-screen w-full bg-neutral-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EdgeDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

// Plain text stand-in for arbitrary panel content — component-level stories
// here must stay in isolation from other fui-components. Text uses
// Typography's `body2` classes directly (not a custom size) to match real
// usage.
const DrawerStory = (args: EdgeDrawerProps, initialOpen: boolean) => {
  const Render = (renderArgs: EdgeDrawerProps) => {
    const [open, setOpen] = useState(initialOpen);
    return (
      <EdgeDrawer {...renderArgs} open={open} onOpenChange={setOpen}>
        <span className="font-monobit text-body2 text-neutral-50">
          Example setting
        </span>
      </EdgeDrawer>
    );
  };
  return { args, render: Render };
};

export const Closed: Story = DrawerStory({} as EdgeDrawerProps, false);
export const Open: Story = DrawerStory({} as EdgeDrawerProps, true);
