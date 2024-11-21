import type { Meta, StoryObj } from '@storybook/react';
import { Typography } from './Typography';

const meta: Meta<typeof Typography> = {
  title: 'Components/Typography',
  component: Typography,
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2', 'caption', 'small', 'button']
    },
    component: {
      control: 'select',
      options: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div']
    }
  }
};

export default meta;

type Story = StoryObj<typeof Typography>;

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-col space-y-4">
      <Typography variant="h1" component="h1">H1 Heading</Typography>
      <Typography variant="h2" component="h2">H2 Heading</Typography>
      <Typography variant="h3" component="h3">H3 Heading</Typography>
      <Typography variant="h4" component="h4">H4 Heading</Typography>
      <Typography variant="h5" component="h5">H5 Heading</Typography>
      <Typography variant="h6" component="h6">H6 Heading</Typography>
      <Typography variant="body1" component="p">Body 1 Paragraph</Typography>
      <Typography variant="body2" component="p">Body 2 Paragraph</Typography>
      <Typography variant="caption" component="span">Caption Text</Typography>
      <Typography variant="small" component="span">Small Text</Typography>
      <Typography variant="button" component="span">Button Text</Typography>
    </div>
  )
};

export const Customizable: Story = {
  args: {
    variant: 'body1',
    component: 'p',
    children: 'Customizable Typography',
  }
};