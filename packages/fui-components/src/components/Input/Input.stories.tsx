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
    placeholder: 'Enter your text here...',
  },
  render: InputContainer,
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Enter your text here...',
  },
  render: InputContainer,
};

export const DefaultWithValue: Story = {
  name: 'Color: Default with Value',
  args: {
    color: 'default',
    defaultValue: 'Hello World',
  },
  render: InputContainer,
};

export const PrimaryWithValue: Story = {
  name: 'Color: Primary with Value',
  args: {
    color: 'primary',
    defaultValue: 'Hello World',
  },
  render: InputContainer,
};

export const FullWidth: Story = {
  args: {
    className: 'w-full',
    placeholder: 'Full width input...',
  },
  render: (args) => (
    <div className="w-[600px]">
      <Input {...args} />
    </div>
  ),
};
