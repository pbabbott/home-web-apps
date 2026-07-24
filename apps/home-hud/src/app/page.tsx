'use client';

import { Button, Typography } from '@abbottland/fui-components';
import { Counter } from './components/Counter';
import { Footer } from './components/Footer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-neutral-800">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Typography variant="h1" component="h1">
          Home HUD
        </Typography>
        <Typography variant="h3" component="h3">
          your house, at a glance
        </Typography>
        <Counter />
        <Button component="a" href="tv-show-cleanup">
          TV Show Cleanup
        </Button>
      </div>
      <Footer />
    </main>
  );
}
