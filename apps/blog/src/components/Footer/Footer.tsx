import Link from 'next/link';
import { Button, Typography, HorizontalRule } from '@abbottland/fui-components';
import { GitHubLogoIcon, LinkedInLogoIcon } from '@radix-ui/react-icons';

export default function Footer() {
  const imageTag = process.env.IMAGE_TAG ?? 'dev';
  return (
    <footer className="bg-neutral-950 w-full">
      <div className="max-w-screen-lg mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8 mb-8">
          {/* Identity + image tag */}
          <div className="flex flex-col items-center sm:items-start gap-1">
            <Typography variant="h6" className="text-neutral-100">
              Brandon Abbott
            </Typography>
            <Typography variant="body1" className="text-neutral-500">
              {imageTag}
            </Typography>
          </div>

          {/* Blog CTA */}
          <Button
            component={Link}
            href="/blog"
            color="primary"
            variant="outlined"
          >
            Read the Blog
          </Button>

          {/* Social links */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/pbabbott/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <GitHubLogoIcon width={24} height={24} />
            </a>
            <a
              href="https://www.linkedin.com/in/brandon-abbott-22352597/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <LinkedInLogoIcon width={24} height={24} />
            </a>
          </div>
        </div>
        <HorizontalRule />

        <div className="mt-10 text-center">
          <Typography variant="caption" className="text-neutral-600">
            © {new Date().getFullYear()} Brandon Abbott. All rights reserved.
          </Typography>
        </div>
      </div>
    </footer>
  );
}
