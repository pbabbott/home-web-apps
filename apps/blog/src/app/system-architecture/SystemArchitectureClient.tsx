'use client';
import StickyHeader from '@/components/StickyHeader/StickyHeader';
import { Typography } from '@abbottland/fui-components';

export default function SystemArchitectureClient() {
  return (
    <div>
      <StickyHeader />
      <main className="pt-20 px-4">
        <Typography
          variant="h1"
          component="h1"
          className="text-neutral-100 mb-4"
        >
          System Architecture
        </Typography>
        <Typography variant="body1" component="p" className="text-neutral-400">
          SECTION UNAVAILABLE. Construction protocols active. Content scheduled
          for future deployment.
        </Typography>
      </main>
    </div>
  );
}
