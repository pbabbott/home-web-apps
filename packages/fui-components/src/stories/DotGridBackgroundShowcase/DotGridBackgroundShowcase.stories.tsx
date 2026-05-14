import {
  DotGridBackground,
  type DotGridBackgroundColor,
} from '../../components/DotGridBackground/DotGridBackground';
import type { StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Showcase/DotGridBackground',
};
export default meta;
type Story = StoryObj<typeof meta>;

const DotGridBackgroundWrapper = ({
  color,
  active,
}: {
  color: DotGridBackgroundColor;
  active?: boolean;
}) => {
  return (
    <div style={{ position: 'relative', width: 240, height: 140 }}>
      <DotGridBackground color={color} active={active} />
    </div>
  );
};

export const AllColors: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6">
      <DotGridBackgroundWrapper color="default" />
      <DotGridBackgroundWrapper color="primary" />
      <DotGridBackgroundWrapper color="secondary" />
      <DotGridBackgroundWrapper color="success" />
      <DotGridBackgroundWrapper color="error" />
      <DotGridBackgroundWrapper color="warning" />
      <DotGridBackgroundWrapper color="accent-purple" />
      <DotGridBackgroundWrapper color="accent-falcon" />
    </div>
  ),
};

export const Active: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6">
      <DotGridBackgroundWrapper color="default" active />
      <DotGridBackgroundWrapper color="primary" active />
      <DotGridBackgroundWrapper color="secondary" active />
      <DotGridBackgroundWrapper color="success" active />
      <DotGridBackgroundWrapper color="error" active />
      <DotGridBackgroundWrapper color="warning" active />
      <DotGridBackgroundWrapper color="accent-purple" active />
      <DotGridBackgroundWrapper color="accent-falcon" active />
    </div>
  ),
};
