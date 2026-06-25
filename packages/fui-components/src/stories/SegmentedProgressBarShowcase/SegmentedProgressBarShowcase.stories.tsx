import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedProgressBar } from '../../components/SegmentedProgressBar/SegmentedProgressBar';
import { TransparentPanel } from '../../components/TransparentPanel/TransparentPanel';

const meta: Meta = {
  title: 'Showcase/SegmentedProgressBar',
};
export default meta;
type Story = StoryObj<typeof meta>;

export const ProgressionStates: Story = {
  render: () => (
    <TransparentPanel color="dark" className="flex flex-col gap-6 max-w-sm p-6">
      <SegmentedProgressBar
        totalSegments={5}
        currentIndex={1}
        showLabel
        labelText="First"
        showIndex
      />
      <SegmentedProgressBar
        totalSegments={5}
        currentIndex={3}
        showLabel
        labelText="Middle"
        showIndex
      />
      <SegmentedProgressBar
        totalSegments={5}
        currentIndex={5}
        showLabel
        labelText="Last"
        showIndex
      />
    </TransparentPanel>
  ),
};
