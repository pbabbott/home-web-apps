'use client';
import {
  Button,
  Typography,
  extendedTwMerge,
} from '@abbottland/fui-components';
import Link from 'next/link';
import MaskReveal from '@/components/MaskReveal/MaskReveal';

interface LandingSectionTitleProps {
  /** When true, runs the mask reveal animation. Change to true when you want to reveal the title. */
  reveal?: boolean;
  animated?: boolean;
  className?: string;
}

export default function LandingSectionTitle({
  reveal = false,
  animated = true,
  className,
}: LandingSectionTitleProps) {
  return (
    <MaskReveal
      reveal={reveal}
      animated={animated}
      direction="left-to-right"
      duration={1500}
      delay={2250}
      className={extendedTwMerge('items-center flex-col flex', className)}
    >
      {/* clamp: scales from 1.5rem on small screens up to h1 natural size (3rem / 48px) */}
      <Typography
        variant="h1"
        component="h1"
        className="mb-4 text-[clamp(1.5rem,7vw,3.5rem)]"
      >
        Abbottland.io
      </Typography>
      <Typography variant="h5" component="h5" className="mb-2">
        A blog sharing technical insights on software engineering
      </Typography>
      <div className="flex gap-2 mb-4">
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            document
              .getElementById('welcome-section')
              ?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Read Manual
        </Button>
        <Link href="/blog">
          <Button variant="contained" color="primary">
            Read Blog
          </Button>
        </Link>
      </div>
    </MaskReveal>
  );
}
