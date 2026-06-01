'use client';

import { Typography, Badge } from '@abbottland/fui-components';
import { CalendarIcon, ClockIcon } from '@radix-ui/react-icons';
type BlogPostHeaderProps = {
  title: string;
  date: string;
  readTime: string;
  categories: string[];
};

export default function BlogPostHeader({
  title,
  date,
  readTime,
  categories,
}: BlogPostHeaderProps) {
  return (
    <header className="mb-8">
      <Typography
        variant="h1"
        component="h1"
        className="w-full text-transparent bg-clip-text bg-gradient-to-r from-primary-500 via-neutral-50 to-accent-falcon-300 mb-4"
      >
        {title}
      </Typography>
      <div className="flex flex-col gap-2 text-neutral-400 text-sm">
        <div className="flex items-center gap-4 mb-4">
          <CalendarIcon width={20} height={20} className="text-neutral-400" />
          <time dateTime={date}>{date}</time>
          <ClockIcon width={20} height={20} className="text-neutral-400" />
          <Typography
            variant="body2"
            component="span"
            className="text-neutral-400"
          >
            {readTime}
          </Typography>
        </div>

        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category} color="dark">
                {category}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
