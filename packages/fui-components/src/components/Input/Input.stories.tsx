import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Input, type InputProps } from './Input';

const meta = {
  title: 'Components/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['default', 'primary'],
      description: 'The color scheme of the input',
    },
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

const InputContainer = (args: InputProps) => <Input {...args} />;

export const Default: Story = {
  name: 'Color: Default',
  args: {
    color: 'default',
  },
  render: InputContainer,
};
export const Primary: Story = {
  name: 'Color: Primary',
  args: {
    color: 'primary',
  },
  render: InputContainer,
};
