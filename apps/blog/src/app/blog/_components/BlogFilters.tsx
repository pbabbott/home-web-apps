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
    <aside className="w-full lg:w-[18%] lg:min-w-[200px] lg:max-w-[280px] lg:shrink-0">
      <div className="sticky top-16 space-y-4">
        <div className="relative border max-w-[75%]">
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

        <Typography
          variant="subtitle1"
          className="text-neutral-400 font-medium uppercase tracking-wider"
        >
          SELECT DOMAIN
        </Typography>

        <CategoryList
          categories={categories}
          categoryCounts={categoryCounts}
          totalCount={posts.length}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>
    </aside>
  );
}
