import Image from 'next/image';
import GradientMockImage from '../GradientMockImage/GradientMockImage';

interface BlogPostBannerImageProps {
  bannerImage?: string;
  slug?: string;
  alt: string;
  containerClassName?: string;
  imageSizes?: string;
}

/**
 * Centralized component for rendering blog post banner images.
 * Shows the banner image if available, otherwise shows a gradient mock image.
 */
export default function BlogPostBannerImage({
  bannerImage,
  slug,
  alt,
  containerClassName = 'w-full h-full relative',
  imageSizes = '(max-width: 768px) 100vw, 768px',
}: BlogPostBannerImageProps) {
  return (
    <div className={containerClassName}>
      {bannerImage && slug ? (
        <Image
          src={`/api/blog-images/${slug}/${bannerImage}`}
          alt={alt}
          fill
          className="object-cover"
          sizes={imageSizes}
        />
      ) : (
        <GradientMockImage seed={slug} />
      )}
    </div>
  );
}
