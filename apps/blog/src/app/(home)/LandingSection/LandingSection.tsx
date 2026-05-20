'use client';
import { useContext } from 'react';
import { HexagonalBackground, Typography } from '@abbottland/fui-components';
import ProgressiveTerminal from './ProgressiveTerminal';
import { LandingSectionContext } from './LandingSection.Context';
import LandingSectionTitle from './LandingSectionTitle';
import MaskReveal from '@/components/MaskReveal/MaskReveal';
import { useHomeContext } from '../Home.Context';

export default function LandingSection() {
  const {
    revealTitle,
    showControlDevices,
    showBackgroundExperience,
    resumeTerminal,
  } = useContext(LandingSectionContext);
  const { animationsEnabled } = useHomeContext();

  return (
    <>
      <div className="relative w-full h-dvh bg-neutral-700">
        <MaskReveal
          reveal={showBackgroundExperience}
          animated={animationsEnabled}
          onComplete={resumeTerminal}
          direction="left-to-right"
          duration={2000}
          delay={0}
          className="absolute inset-0"
        >
          <HexagonalBackground sparksEnabled={animationsEnabled} />
        </MaskReveal>

        <div className="relative z-10 flex flex-col gap-6 pt-[calc(var(--header-height)+1rem)] px-4 max-w-screen-md mx-auto">
          <LandingSectionTitle
            reveal={revealTitle}
            animated={animationsEnabled}
            onComplete={resumeTerminal}
            revealButtons={showControlDevices}
            onButtonsComplete={resumeTerminal}
          />
          <ProgressiveTerminal animated={animationsEnabled} />
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
