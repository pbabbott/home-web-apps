import type { Meta, StoryObj } from '@storybook/react';
import { Comparator } from './Comparator';

type ComparatorProps = React.ComponentProps<typeof Comparator>;

const meta = {
  title: 'Data Display/Comparator',
  component: Comparator,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: 'color',
      description: 'The color of the text',
    },
    unitA: {
      control: 'text',
      description: 'The value for Unit A',
    },
    unitB: {
      control: 'text',
      description: 'The value for Unit B',
    },
    unitACaption: {
      control: 'text',
      description: 'Caption for Unit A',
    },
    unitBCaption: {
      control: 'text',
      description: 'Caption for Unit B',
    },
    label: {
      control: 'text',
      description: 'Label for the comparator',
    },
  },
  args: {
    color: '',
    unitA: '1234',
    unitB: '21234',
    unitACaption: 'Caption A',
    unitBCaption: 'Caption B',
    label: 'Comparison',
  },
} satisfies Meta<typeof Comparator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default Comparator',
  args: {},
};

export const CustomColors: Story = {
  name: 'Custom Colors',
  args: {
    color: '#ff5733',
  },
};
