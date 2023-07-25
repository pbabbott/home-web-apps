// Button.stories.ts|tsx

import type { Meta, StoryObj } from '@storybook/react';

import { Panel } from './Panel';
import { Text } from '../Text/Text';
import { Button } from '../Button/Button';

const meta: Meta<typeof Panel> = {
  component: Panel,
};

export default meta;
type Story = StoryObj<typeof Panel>;

const getChildren = (buttonType: 'primary' | 'secondary') => {
    return (
        <>
        <div>
            <Text label="I am a header" font="h4" />
            <Text TagOverride='p' label="The quick brown fox jumped over the lazy dog." font="body2" />
        </div>
        <div className='flex flex-row-reverse'>
            <Button label="Button" type={buttonType} />
        </div>
        </>
    )
}

export const Default: Story = {
    args: {
      type: 'default',
      children: getChildren('secondary')
    },
  }

export const White: Story = {
    args: {
        type: 'white',
        children: getChildren('primary')
    },
}
  

export const Primary: Story = {
  args: {
    type: 'primary',
    children: getChildren('primary')
  },
}

export const Secondary: Story = {
  args: {
    type: 'secondary',
    children: getChildren('secondary')
  },
}
