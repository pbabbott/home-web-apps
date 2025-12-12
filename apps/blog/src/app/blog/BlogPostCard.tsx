'use client';
import {
  Card,
  Typography,
  Button,
  HorizontalRule,
  type CardSize,
  Badge,
} from '@abbottland/fui-components';
import { CalendarIcon, ClockIcon } from '@radix-ui/react-icons';
import type { BlogCategory } from './blogPosts';

interface BlogPostCardProps {
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  slug?: string;
  category?: BlogCategory;
  image?: string;
  size?: CardSize;
  onClick?: () => void;
}

const subTextColor = 'text-neutral-500';

export default function BlogPostCard({
  title,
  excerpt,
  date,
  readTime,
  slug,
  category,
  image,
  size = 'default',
  onClick,
}: BlogPostCardProps) {
  const handleReadMore = () => {
    if (onClick) {
      onClick();
    } else if (slug) {
      window.location.href = `/blog/${slug}`;
    }
  };

  return (
    <Card color="primary" size={size}>
      {image && (
        <div
          className="w-full h-32 rounded-md mb-4 overflow-hidden"
          style={{ background: image }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-3xl opacity-20 font-mono tracking-tighter">
              {'</>'}
            </div>
          </div>
        </div>
      )}
      {category && (
        <div className="mb-2">
          <Badge color="primary">{category}</Badge>
        </div>
      )}
      <Typography
        variant="h3"
        component="h3"
        className="w-fit text-transparent bg-clip-text bg-neutral-200 transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-primary-500 group-hover:via-neutral-50 group-hover:to-accent-falcon-300"
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        className="mb-4 text-neutral-300 transition-all duration-300 group-hover:text-neutral-50 line-clamp-3"
      >
        {excerpt}
      </Typography>
      <div className="flex flex-row gap-x-2 items-center">
        <CalendarIcon width={20} height={20} className={subTextColor} />
        <Typography variant="body2" component="span" className={subTextColor}>
          {date}
        </Typography>
        <ClockIcon width={20} height={20} className={subTextColor} />
        <Typography variant="body2" component="span" className={subTextColor}>
          {readTime}
        </Typography>
      </div>
      <HorizontalRule color="primary" />
      <div className="flex justify-end">
        <Button color="primary" variant="text" onClick={handleReadMore}>
          &gt; READ_MORE
        </Button>
      </div>
    </Card>
  );
}
