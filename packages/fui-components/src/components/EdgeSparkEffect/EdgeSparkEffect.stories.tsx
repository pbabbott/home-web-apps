import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EdgeSparkEffect, type EdgeSparkEffectProps } from './EdgeSparkEffect';

const SAMPLE_PATH = 'M 20 20 L 20 100 L 220 100 L 220 180';

const meta = {
  title: 'Components/EdgeSparkEffect',
  component: EdgeSparkEffect,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accent-purple',
        'accent-falcon',
        'neutral',
      ],
      description: 'Color of the traveling spark',
    },
    edgePath: {
      control: 'text',
      description: 'SVG path the spark travels along',
    },
    id: {
      control: false,
      description:
        'Must match the id of a <path> elsewhere in the SVG that the spark motion targets',
    },
    oneShot: {
      control: 'boolean',
      description:
        'Play once from the start of the path and hold, instead of looping forever',
    },
  },
  args: {
    edgePath: SAMPLE_PATH,
    id: 'story-edge-spark',
  },
} satisfies Meta<typeof EdgeSparkEffect>;

export default meta;
type Story = StoryObj<typeof meta>;

const SparkStory = (name: string, color: EdgeSparkEffectProps['color']) => {
  return {
    name,
    args: { color },
    render: (args: EdgeSparkEffectProps) => (
      <div className="bg-neutral-900 p-6">
        <svg width={240} height={200} viewBox="0 0 240 200">
          <path
            id={args.id}
            d={args.edgePath}
            fill="none"
            stroke="#333"
            strokeWidth={1}
          />
          <EdgeSparkEffect {...args} />
        </svg>
      </div>
    ),
  };
};

export const ColorPrimary: Story = SparkStory('Primary', 'primary');
export const ColorSecondary: Story = SparkStory('Secondary', 'secondary');
export const ColorSuccess: Story = SparkStory('Success', 'success');
export const ColorError: Story = SparkStory('Error', 'error');
export const ColorWarning: Story = SparkStory('Warning', 'warning');
export const ColorAccentPurple: Story = SparkStory(
  'AccentPurple',
  'accent-purple',
);
export const ColorAccentFalcon: Story = SparkStory(
  'AccentFalcon',
  'accent-falcon',
);
export const ColorNeutral: Story = SparkStory('Neutral', 'neutral');

const OneShotDemo = (args: EdgeSparkEffectProps) => {
  const [playKey, setPlayKey] = useState(0);
  return (
    <div className="bg-neutral-900 p-6 flex flex-col gap-4">
      <svg width={240} height={200} viewBox="0 0 240 200">
        <path
          id={args.id}
          d={args.edgePath}
          fill="none"
          stroke="#333"
          strokeWidth={1}
        />
        <EdgeSparkEffect key={playKey} {...args} />
      </svg>
      <button
        onClick={() => setPlayKey((k) => k + 1)}
        className="self-start text-neutral-100 border border-neutral-700 px-3 py-1 text-xs uppercase cursor-pointer"
      >
        Replay
      </button>
    </div>
  );
};

export const OneShot: Story = {
  name: 'One-Shot',
  args: { oneShot: true },
  render: (args: EdgeSparkEffectProps) => <OneShotDemo {...args} />,
};
