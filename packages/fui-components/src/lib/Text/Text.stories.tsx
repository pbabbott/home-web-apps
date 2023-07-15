

// Button.stories.ts|tsx

import type { Meta, StoryObj } from '@storybook/react';

import { Text, TextProps } from './Text';

const meta: Meta<typeof Text> = {
  component: Text,
};

export default meta;
type Story = StoryObj<typeof Text>;

const getArgs = (font: string) => {
  return {
    label: 'hello world',
    font
  } as Partial<TextProps>
}

export const h1: Story = {
  args: getArgs('h1'),
}
export const h2: Story = {
  args: getArgs('h2'),
}
export const h3: Story = {
  args: getArgs('h3'),
}
export const h4: Story = {
  args: getArgs('h4'),
}
export const h5: Story = {
  args: getArgs('h5'),
}
export const h6: Story = {
  args: getArgs('h6'),
}
export const body1: Story = {
  args: getArgs('body1'),
}
export const body2: Story = {
  args: getArgs('body2'),
}
export const caption: Story = {
  args: getArgs('caption'),
}
export const small: Story = {
  args: getArgs('small'),
}

export const Body2Paragraph: Story = {
  args: {
    label: 'Single-origin coffee pour-over in vape, tempor flannel wayfarers knausgaard pitchfork williamsburg. Green juice laboris scenester sartorial blue bottle, qui neutral milk hotel. Ugh franzen veniam, et jianbing truffaut glossier church-key listicle tumblr tattooed vibecession praxis. Hashtag fixie qui cliche put a bird on it salvia shoreditch kinfolk magna in. Small batch forage aliquip helvetica green juice cray wayfarers fanny pack twee freegan pug.',
    font: 'body2',
    TagOverride: 'p'
  }
}