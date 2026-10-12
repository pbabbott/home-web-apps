'use client';

import { Typography } from '@abbottland/fui-components';
import { Footer } from './components/Footer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-neutral-800">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Typography variant="h1" component="h1">
          Welcome to Home HUD
        </Typography>
      </div>
      <Footer />
    </main>
  );
}
