import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  type ButtonColor,
  type ButtonSize,
} from '../../components/Button/Button';
import { OutlinedButton } from '../../components/OutlinedButton/OutlinedButton';
import { Typography } from '../../components/Typography/Typography';

const meta: Meta<typeof Button> = {
  title: 'Showcase/Button',
};
export default meta;
type Story = StoryObj<typeof meta>;

const ButtonVariants = ({ color }: { color: ButtonColor }) => (
  <div className="grid grid-cols-3 gap-4">
    <div className="flex justify-center">
      <Button color={color}>{color}</Button>
    </div>
    <div className="flex justify-center">
      <OutlinedButton color={color}>{color} Outlined</OutlinedButton>
    </div>
    <div className="flex justify-center">
      <Button color={color} variant="text">
        {color} Text
      </Button>
    </div>
  </div>
);

export const ColorsAndVariants: Story = {
  render: () => (
    <div className="grid gap-4 grid-auto-rows max-w-4xl">
      <ButtonVariants color="primary" />
      <ButtonVariants color="secondary" />
      <ButtonVariants color="success" />
      <ButtonVariants color="error" />
      <ButtonVariants color="warning" />
      <ButtonVariants color="accent-purple" />
      <ButtonVariants color="accent-falcon" />
      <ButtonVariants color="neutral" />
    </div>
  ),
};

const SizeRow = ({ size }: { size: ButtonSize }) => (
  <div className="grid grid-cols-3 gap-4">
    <div className="flex justify-center">
      <Button size={size} color="primary">
        Contained
      </Button>
    </div>
    <div className="flex justify-center">
      <OutlinedButton size={size} color="primary">
        Outlined
      </OutlinedButton>
    </div>
    <div className="flex justify-center">
      <Button size={size} color="primary" variant="text">
        Text
      </Button>
    </div>
  </div>
);

export const SizesAndVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Typography
          variant="caption"
          component="p"
          className="mb-2 text-neutral-400"
        >
          Default size
        </Typography>
        <SizeRow size="default" />
      </div>
      <div>
        <Typography
          variant="caption"
          component="p"
          className="mb-2 text-neutral-400"
        >
          Small size
        </Typography>
        <SizeRow size="small" />
      </div>
    </div>
  ),
};
