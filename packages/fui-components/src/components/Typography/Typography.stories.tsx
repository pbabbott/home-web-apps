import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from './Typography';

const meta: Meta<typeof Typography> = {
  title: 'Components/Typography',
  component: Typography,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'body1',
        'body2',
        'caption',
        'small',
        'button',
      ],
    },
    component: {
      control: 'select',
      options: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Typography>;

export const Body2: Story = {
  args: {
    variant: 'body2',
    component: 'p',
    children: 'Body 2 Paragraph',
  },
};

export const Body1: Story = {
  args: {
    variant: 'body1',
    component: 'p',
    children: 'Body 1 Paragraph',
  },
};

export const Caption: Story = {
  args: {
    variant: 'caption',
    component: 'span',
    children: 'Caption Text',
  },
};

export const Small: Story = {
  args: {
    variant: 'small',
    component: 'span',
    children: 'Small Text',
  },
};

export const Button: Story = {
  args: {
    variant: 'button',
    component: 'span',
    children: 'Button Text',
  },
};

export const H1: Story = {
  args: {
    variant: 'h1',
    component: 'h1',
    children: 'H1 Heading',
  },
};

export const H2: Story = {
  args: {
    variant: 'h2',
    component: 'h2',
    children: 'H2 Heading',
  },
};

export const H3: Story = {
  args: {
    variant: 'h3',
    component: 'h3',
    children: 'H3 Heading',
  },
};

export const H4: Story = {
  args: {
    variant: 'h4',
    component: 'h4',
    children: 'H4 Heading',
  },
};

export const H5: Story = {
  args: {
    variant: 'h5',
    component: 'h5',
    children: 'H5 Heading',
  },
};

export const H6: Story = {
  args: {
    variant: 'h6',
    component: 'h6',
    children: 'H6 Heading',
  },
};
