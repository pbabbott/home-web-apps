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
  /** Called once when the title reveal animation finishes. */
  onComplete?: () => void;
  /** When true, reveals the action buttons. */
  revealButtons?: boolean;
  /** Called once when the buttons reveal animation finishes. */
  onButtonsComplete?: () => void;
  className?: string;
}

export default function LandingSectionTitle({
  reveal = false,
  animated = true,
  onComplete,
  revealButtons = false,
  onButtonsComplete,
  className,
}: LandingSectionTitleProps) {
  return (
    <div className={extendedTwMerge('items-center flex-col flex', className)}>
      <MaskReveal
        reveal={reveal}
        animated={animated}
        onComplete={onComplete}
        direction="left-to-right"
        duration={1500}
        delay={0}
        className="items-center flex-col flex"
      >
        {/* clamp: scales from 1.5rem on small screens up to h1 natural size (3rem / 48px) */}
        <Typography
          variant="h1"
          component="h1"
          className="mb-2 text-[clamp(1.5rem,7vw,3.5rem)]"
        >
          Abbottland.io
        </Typography>
        <Typography variant="h5" component="h5" className="mb-6 text-center">
          A blog sharing technical insights on software engineering
        </Typography>
      </MaskReveal>
      <MaskReveal
        reveal={revealButtons}
        animated={animated}
        onComplete={onButtonsComplete}
        direction="left-to-right"
        duration={800}
        delay={0}
      >
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
          <Button
            component={Link}
            href="/blog"
            variant="contained"
            color="primary"
          >
            Read Blog
          </Button>
        </div>
      </MaskReveal>
    </div>
  );
}
