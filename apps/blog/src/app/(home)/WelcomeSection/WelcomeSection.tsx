'use client';

import Image from 'next/image';
import { TransparentPanel, Typography } from '@abbottland/fui-components';
import RaspberryPi from '@/components/RaspberryPi/RaspberryPi';

export default function WelcomeSection() {
  return (
    <div
      id="welcome-section"
      className="bg-neutral-800 w-full flex flex-col items-center justify-center px-4 py-18 min-h-[calc(100vh-var(--header-height))]"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-screen-lg gap-6">
        <Typography variant="h2" component="h2">
          Welcome to Abbottland.io
        </Typography>
        <hr className="w-full border-primary-500" />
        <Typography variant="body1" component="p">
          Technical Tutorials, Architecture Insights, and Developer Experiments
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Typography variant="h4" component="h4" className="mb-2">
              &gt; What this site is
            </Typography>
            <TransparentPanel color="primary" className="mb-4">
              <Typography variant="body1" component="p">
                Abbottland.io is a blog exploring the craft of software
                engineering - from hands-on tutorials to deep dives into
                architecture, systems, and developer tooling.
              </Typography>
            </TransparentPanel>
            <div className="flex items-center justify-center flex-col mb-4">
              <Image
                src="/home/qBitTorrent_Architecture.excalidraw.svg"
                alt="qBitTorrent Architecture"
                width={400}
                height={400}
                className="mb-2"
              />
              <Typography variant="caption" component="span">
                qBitTorrent Architecture
              </Typography>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center flex-col mb-4">
              <RaspberryPi
                width={300}
                height={300}
                className="fill-primary-500 mb-2"
              />
              <Typography variant="caption" component="span">
                Raspberry Pi
              </Typography>
            </div>
            <Typography variant="h4" component="h4" className="mb-2">
              &gt; What you&apos;ll find here
            </Typography>
            <TransparentPanel color="secondary">
              <Typography variant="body1" component="p">
                Whether its building efficient pipelines, automating workflows,
                or designing maintainable systems, the goal is simple: share
                clear, practical insights that engineers can actually use.
              </Typography>
            </TransparentPanel>
          </div>
        </div>

        <hr className="w-full border-primary-500" />
      </div>
    </div>
  );
}
