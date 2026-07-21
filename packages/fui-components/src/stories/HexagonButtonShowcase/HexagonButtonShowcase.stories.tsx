import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TiledHexagons } from '../../components/TiledHexagons/TiledHexagons';
import { Typography } from '../../components/Typography/Typography';

const meta: Meta = {
  title: 'Showcase/HexagonButton',
  parameters: {
    layout: 'centered',
  },
  globals: {
    backgrounds: { value: 'dark', grid: true },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

// Mirrors apps/blog's CategoryList: a cluster of hexagon tiles used as a
// category filter, where clicking a tile selects it (and re-clicking the
// selected tile falls back to "All Posts").
const CATEGORY_COUNTS: Record<string, number> = {
  Engineering: 12,
  Homelab: 8,
  Kubernetes: 5,
  Networking: 3,
};

const CategoryFilterCluster = () => {
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const categories = Object.keys(CATEGORY_COUNTS);
  const totalCount = Object.values(CATEGORY_COUNTS).reduce(
    (sum, count) => sum + count,
    0,
  );

  const tiles = ['All', ...categories].map((category) => ({
    label: category === 'All' ? 'All Posts' : category,
    lowerLabel:
      category === 'All'
        ? String(totalCount)
        : String(CATEGORY_COUNTS[category] ?? 0),
    active: selectedCategory === category,
    onClick: () => {
      setSelectedCategory((prev) =>
        prev === category && category !== 'All' ? 'All' : category,
      );
    },
  }));

  return (
    <div className="flex flex-col gap-2">
      <Typography
        variant="body2"
        className="text-neutral-400 font-medium uppercase tracking-wider"
      >
        Filter Controls
      </Typography>
      <TiledHexagons tiles={tiles} maxHorizontal={3} tileGap={2} />
    </div>
  );
};

export const CategoryFilter: Story = {
  render: () => <CategoryFilterCluster />,
};
