'use client';
import { useContext, useEffect, useState } from 'react';
import { HexagonalBackground, Typography } from '@abbottland/fui-components';
import ProgressiveTerminal from './ProgressiveTerminal';
import { LandingSectionContext } from './LandingSection.Context';
import LandingSectionTitle from './LandingSectionTitle';
import MaskReveal from '@/app/components/MaskReveal';

export default function LandingSection() {
  const [isXSScreen, setIsXSScreen] = useState(false);
  const { revealTitle, showBackgroundExperience } = useContext(
    LandingSectionContext,
  );

  // Effect to check screen size for responsive typography
  useEffect(() => {
    const checkScreenSize = () => {
      // xs screen size breakpoint is at 576px
      setIsXSScreen(window.innerWidth < 576);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  /* Spacer so content starts below fixed header; height must match --header-height */
  /* <div className="h-[var(--header-height)]" aria-hidden /> */

  return (
    <>
      <div className="h-[var(--header-height)] bg-neutral-700"></div>
      <div className="relative w-full h-[calc(100vh-var(--header-height))] bg-neutral-700">
        <MaskReveal
          reveal={showBackgroundExperience}
          direction="left-to-right"
          duration={2000}
          delay={2000}
          className="absolute inset-0"
        >
          <HexagonalBackground />
        </MaskReveal>

        <div className="relative z-10 flex flex-col pt-32 px-4 max-w-screen-md mx-auto">
          <div className="flex flex-col min-h-[50vh] shrink-0">
            <LandingSectionTitle
              isXSScreen={isXSScreen}
              reveal={revealTitle}
              className="shrink-0"
            />
            <div className="flex flex-1 items-center justify-center min-h-0">
              <ProgressiveTerminal />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end mt-auto py-4 absolute bottom-0 left-0 w-full">
          <Typography variant="caption" component="span">
            Crafted with &lt;3 by Brandon Abbott
          </Typography>
        </div>
      </div>
    </>
  );
}
