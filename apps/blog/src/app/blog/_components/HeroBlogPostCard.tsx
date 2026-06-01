'use client';
import {
  Badge,
  Card,
  Typography,
  Button,
  HorizontalRule,
} from '@abbottland/fui-components';
import { CalendarIcon, ClockIcon } from '@radix-ui/react-icons';
import type { BlogPost } from '../../../types/blog';
import BlogPostBannerImage from '@/components/BlogPostBannerImage/BlogPostBannerImage';

interface HeroBlogPostCardProps {
  post: BlogPost;
  onClick?: () => void;
}

const subTextColor = 'text-neutral-400';

export default function HeroBlogPostCard({
  post,
  onClick,
}: HeroBlogPostCardProps) {
  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else if (post.slug) {
      window.location.href = `/blog/${post.slug}`;
    }
  };

  const handleReadMore = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when button is clicked
    if (onClick) {
      onClick();
    } else if (post.slug) {
      window.location.href = `/blog/${post.slug}`;
    }
  };

  return (
    <Card color="primary" size="large" onClick={handleCardClick}>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Featured Image */}
        <div className="w-full lg:w-2/5 h-48 lg:h-64 rounded-lg overflow-hidden flex-shrink-0">
          <BlogPostBannerImage
            bannerImage={post.bannerImage}
            slug={post.slug}
            alt={post.title}
            containerClassName="w-full h-full relative"
            imageSizes="(max-width: 1024px) 100vw, 40vw"
          />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-grow justify-between">
          <div>
            {post.categories && post.categories.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {post.categories.map((category) => (
                  <Badge key={category} color="dark">
                    {category}
                  </Badge>
                ))}
              </div>
            )}
            <Typography
              variant="h2"
              component="h2"
              className="w-fit text-transparent bg-clip-text bg-neutral-100 transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-primary-500 group-hover:via-neutral-50 group-hover:to-accent-falcon-300 mb-4"
            >
              {post.title}
            </Typography>
            <Typography
              variant="body1"
              className="mb-6 text-neutral-300 transition-all duration-300 group-hover:text-neutral-50"
            >
              {post.excerpt}
            </Typography>
          </div>

          <div>
            <div className="flex flex-row gap-x-4 items-center mb-4">
              <div className="flex items-center gap-x-2">
                <CalendarIcon width={18} height={18} className={subTextColor} />
                <Typography
                  variant="body2"
                  component="span"
                  className={subTextColor}
                >
                  {post.date}
                </Typography>
              </div>
              <div className="flex items-center gap-x-2">
                <ClockIcon width={18} height={18} className={subTextColor} />
                <Typography
                  variant="body2"
                  component="span"
                  className={subTextColor}
                >
                  {post.readTime}
                </Typography>
              </div>
            </div>
            <HorizontalRule color="primary" />
            <div className="flex justify-end mt-4">
              <Button color="primary" variant="text" onClick={handleReadMore}>
                &gt; READ_MORE
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
