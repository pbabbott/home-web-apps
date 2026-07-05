'use client';

import { useEffect, useState } from 'react';
import { TiledHexagons } from '@abbottland/fui-components';

/**
 * Tailwind default breakpoints (min-width px) → maxHorizontal.
 * Order: ascending (default, sm 640, md 768, lg 1024, xl 1280, 2xl 1536).
 */
const BREAKPOINT_MAX_HORIZONTAL: {
  minWidthPx: number;
  maxHorizontal: number;
}[] = [
  { minWidthPx: 0, maxHorizontal: 4 }, // default
  { minWidthPx: 640, maxHorizontal: 7 }, // sm
  { minWidthPx: 768, maxHorizontal: 7 }, // md
  { minWidthPx: 1024, maxHorizontal: 3 }, // lg
  { minWidthPx: 1280, maxHorizontal: 3 }, // xl
  { minWidthPx: 1536, maxHorizontal: 3 }, // 2xl
];

function useMaxHorizontal() {
  const [maxHorizontal, setMaxHorizontal] = useState(
    () => BREAKPOINT_MAX_HORIZONTAL[0].maxHorizontal,
  );
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      let match = BREAKPOINT_MAX_HORIZONTAL[0].maxHorizontal;
      for (let i = BREAKPOINT_MAX_HORIZONTAL.length - 1; i >= 0; i--) {
        if (w >= BREAKPOINT_MAX_HORIZONTAL[i].minWidthPx) {
          match = BREAKPOINT_MAX_HORIZONTAL[i].maxHorizontal;
          break;
        }
      }
      setMaxHorizontal(match);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return maxHorizontal;
}

export type CategoryFilter = 'All' | string;

interface CategoryListProps {
  categories: string[];
  /** Count of posts per category (category name -> count). Used for lower label. */
  categoryCounts: Record<string, number>;
  /** Total number of posts (for "All" lower label). */
  totalCount: number;
  selectedCategory: CategoryFilter;
  onSelectCategory: (category: CategoryFilter) => void;
}

export default function CategoryList({
  categories,
  categoryCounts,
  totalCount,
  selectedCategory,
  onSelectCategory,
}: CategoryListProps) {
  const sortedCategories = [...categories].sort((a, b) => {
    const countDiff = (categoryCounts[b] ?? 0) - (categoryCounts[a] ?? 0);
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b);
  });
  const allCategories: CategoryFilter[] = ['All', ...sortedCategories];

  const maxHorizontal = useMaxHorizontal();

  const tiles = allCategories.map((category) => ({
    label: category === 'All' ? 'All Posts' : category,
    lowerLabel:
      category === 'All'
        ? String(totalCount)
        : String(categoryCounts[category] ?? 0),
    active: selectedCategory === category,
    onClick: () => {
      if (selectedCategory === category && category !== 'All') {
        onSelectCategory('All');
      } else {
        onSelectCategory(category);
      }
    },
  }));

  return (
    <div className="pr-1">
      {/* Hexagons sit inset within their square tiles, so nudge the whole grid
          left to visually align the leftmost hex edges with the container. */}
      <div className="relative -left-4">
        <TiledHexagons
          tiles={tiles}
          maxHorizontal={maxHorizontal}
          tileGap={2}
        />
      </div>
    </div>
  );
}
