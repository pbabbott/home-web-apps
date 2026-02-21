'use client';

import { TiledHexagons } from '@abbottland/fui-components';

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
    <div className="max-h-[50vh] pr-1">
      <TiledHexagons tiles={tiles} maxHorizontal={3} tileGap={4} />
    </div>
  );
}
