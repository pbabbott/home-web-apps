'use client';
import { useContext, useEffect, useRef, useState } from 'react';
import { Button, Typography } from '@abbottland/fui-components';
import ProgressiveTerminal from './ProgressiveTerminal';
import { LandingSectionContext } from './LandingSection.Context';
import AnimatedGradient from './AnimatedGradient';
import { particlesConfig } from '@/config/particles';
import anime from 'animejs';

export default function LandingSection() {
  const { showParticles } = useContext(LandingSectionContext);
  const [isXSScreen, setIsXSScreen] = useState(false);

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

  const { showBackgroundColors } = useContext(LandingSectionContext);

  useEffect(() => {
    // Dynamically import particles.js to avoid SSR issues
    if (typeof window !== 'undefined') {
      import('particles.js').then(() => {
        if (window.particlesJS) {
          window.particlesJS('particles-js', particlesConfig);
        }
      });
    }
  }, []);

  const particlesRef = useRef<HTMLDivElement>(null);

  // Initialize particles with opacity 0
  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.style.opacity = '0';
    }
  }, []);

  // Animate particles fade-in when showParticles becomes true
  useEffect(() => {
    if (showParticles && particlesRef.current) {
      anime({
        targets: particlesRef.current,
        opacity: [0, 1],
        duration: 3000,
        delay: 1000,
        easing: 'easeInOutQuad',
      });
    }
  }, [showParticles]);

  return (
    <AnimatedGradient
      isAnimated={showBackgroundColors}
      className={`w-full min-h-screen`}
    >
      <div className="z-10 flex flex-col items-center justify-center min-h-screen px-4 max-w-screen-md mx-auto">
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
          <Button variant="contained" color="secondary">
            Read Manual
          </Button>
          <Button variant="contained" color="primary">
            Read Blog
          </Button>
        </div>
        <ProgressiveTerminal />
      </div>
      <div className="flex items-center justify-end absolute bottom-0 left-0 w-full z-10">
        <Typography variant="caption" component="span">
          Crafted with &lt;3 by Brandon Abbott
        </Typography>
      </div>

      <div
        id="particles-js"
        className="absolute inset-0 w-full h-full z-20 opacity-0"
        ref={particlesRef}
      ></div>
    </AnimatedGradient>
  );
}
