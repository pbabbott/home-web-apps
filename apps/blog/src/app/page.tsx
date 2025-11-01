'use client';
import { Button, Typography, Panel } from 'fui-components';
import { useEffect } from 'react';
import { particlesConfig } from '@/config/particles';

export default function Home() {
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-800">
      <div className="relative w-full min-h-screen bg-secondary-900">
        {/* Particles.js background container */}
        <div
          id="particles-js"
          className="absolute inset-0 w-full h-full z-20"
        />
        {/* Content layer */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          <Typography variant="h1" component="h1" className="mb-2">
            Abbottland.io
          </Typography>
          <Typography variant="h5" component="h5" className="mb-2">
            A blog sharing technical insights on software engineering.
          </Typography>
          <Typography variant="body1" component="p" className="mb-2">
            Crafted with &lt;3 by Brandon Abbott
          </Typography>
        </div>
        {/* Scroll Hint */}
        <div className="flex items-center justify-center absolute bottom-0 left-0 w-full h-10 z-10 text-white">
          <Typography variant="body1" component="p">
            &darr; Scroll down for more content &darr;
          </Typography>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center w-full max-w-3xl gap-6 py-32">
        <Panel color="primary" variant="outlined">
          <Typography variant="h4" component="h4">
            Welcome to Abbottland.io
          </Typography>
          <Typography variant="body1" component="p">
            This is the home page of Abbottland.io
          </Typography>
        </Panel>
      </div>
    </div>
  );
}
