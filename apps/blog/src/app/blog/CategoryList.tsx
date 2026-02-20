'use client';

import { Button } from '@abbottland/fui-components';

export type CategoryFilter = 'All' | string;

interface CategoryListProps {
  categories: string[];
  selectedCategory: CategoryFilter;
  onSelectCategory: (category: CategoryFilter) => void;
}

export default function CategoryList({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryListProps) {
  const allCategories: CategoryFilter[] = ['All', ...categories];

  return (
    <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto pr-1">
      {allCategories.map((category) => (
        <Button
          key={category}
          color="primary"
          variant={selectedCategory === category ? 'contained' : 'outlined'}
          onClick={() => onSelectCategory(category)}
          className="justify-start text-left w-full"
        >
          {category === 'All' ? 'All Posts' : category}
        </Button>
      ))}
    </div>
  );
}
