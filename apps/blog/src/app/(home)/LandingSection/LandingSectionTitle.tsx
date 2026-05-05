'use client';
import {
  Button,
  Typography,
  extendedTwMerge,
} from '@abbottland/fui-components';
import Link from 'next/link';
import MaskReveal from '../../components/MaskReveal';

interface LandingSectionTitleProps {
  isXSScreen: boolean;
  /** When true, runs the mask reveal animation. Change to true when you want to reveal the title. */
  reveal?: boolean;
  className?: string;
}

export default function LandingSectionTitle({
  isXSScreen,
  reveal = false,
  className,
}: LandingSectionTitleProps) {
  return (
    <MaskReveal
      reveal={reveal}
      direction="left-to-right"
      duration={1500}
      delay={2250}
      className={extendedTwMerge('items-center flex-col flex', className)}
    >
      <Typography
        variant={isXSScreen ? 'h2' : 'h1'}
        component="h1"
        className="mb-2"
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
