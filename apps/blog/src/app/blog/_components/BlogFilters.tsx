'use client';
import { Input, Typography } from '@abbottland/fui-components';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import CategoryList from './CategoryList';
import { useBlogPageContext } from './Blog.Context';

export default function BlogFilters() {
  const {
    categories,
    categoryCounts,
    posts,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
  } = useBlogPageContext();

  return (
    <aside className="w-full lg:w-[325px] lg:shrink-0">
      <div className="sticky top-16 flex flex-col gap-4 lg:h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:overflow-x-hidden">
        <Typography
          variant="subtitle1"
          className="text-neutral-400 font-medium uppercase tracking-wider"
        >
          FILTER CONTROLS
        </Typography>

        <div className="flex flex-col lg:self-center">
          <div className="relative border max-w-[75%] mb-4">
            <MagnifyingGlassIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none z-10"
              width={18}
              height={18}
            />
            <Input
              color="primary"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchTerm(e.target.value)
              }
              className="w-full pl-9"
            />
          </div>

          <div className="min-h-0 lg:flex-1">
            <CategoryList
              categories={categories}
              categoryCounts={categoryCounts}
              totalCount={posts.length}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
