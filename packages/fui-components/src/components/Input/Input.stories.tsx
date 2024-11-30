import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { Input, InputProps } from './Input';
import { Panel } from '../Panel/Panel';

const meta = {
  title: 'Inputs/Input',
  component: Input,
  globals: {
    backgrounds: { grid: true }
  },
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['default', 'primary'],
      description: 'The color scheme of the input'
    },
  },
  args: { 
    onClick: fn(),
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

const InputContainer = (args: InputProps) => (
    <Panel color={args.color} className='min-w-80 min-h-80 flex items-center'>
        <Input {...args} />
    </Panel>
)

export const Default: Story = {
    name: 'Color: Default',
    args: {
      color: 'default'
    },
    render: InputContainer
  };
  export const Primary: Story = {
    name: 'Color: Primary',
    args: {
      color: 'primary'
    },
    render: InputContainer
  };