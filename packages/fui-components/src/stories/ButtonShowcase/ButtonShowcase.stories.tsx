import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button, type ButtonColor } from '../../components/Button/Button';

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
      <Button color={color} variant="outlined">
        {color} Outlined
      </Button>
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
    </div>
  ),
};
