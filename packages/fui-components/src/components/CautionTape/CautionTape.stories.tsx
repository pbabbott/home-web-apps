import type { Meta, StoryObj } from '@storybook/react-vite';

import { CautionTape } from './CautionTape';

const meta = {
  title: 'Components/CautionTape',
  component: CautionTape,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Text rendered on the tape',
    },
    angle: {
      control: { type: 'range', min: -15, max: 15, step: 1 },
      description: 'Rotation in degrees',
    },
  },
  decorators: [
    (Story) => (
      <div className="relative h-64 w-96 overflow-hidden bg-neutral-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CautionTape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    angle: -2,
  },
};

export const CustomLabel: Story = {
  args: {
    label: 'UNDER CONSTRUCTION',
    angle: -2,
  },
};

export const Straight: Story = {
  args: {
    label: 'RESTRICTED AREA',
    angle: 0,
  },
};

export const OverContent: Story = {
  args: {
    label: 'OFFLINE',
    angle: -3,
  },
  render: (args) => (
    <>
      <div className="flex h-full items-center justify-center p-4 text-center text-neutral-400">
        Panel content sits underneath the tape overlay.
      </div>
      <CautionTape {...args} />
    </>
  ),
};
