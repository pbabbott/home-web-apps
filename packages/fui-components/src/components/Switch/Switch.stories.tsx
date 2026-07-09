import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Switch } from './Switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Whether the switch is on',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the switch is disabled',
    },
    onCheckedChange: { action: 'checkedChange' },
  },
  args: {
    onCheckedChange: fn(),
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  args: {
    defaultChecked: false,
  },
};

export const On: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    defaultChecked: false,
    disabled: true,
  },
};

export const DisabledOn: Story = {
  name: 'Disabled (On)',
  args: {
    defaultChecked: true,
    disabled: true,
  },
};
