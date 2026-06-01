'use client';

import Image from 'next/image';
import {
  HorizontalRule,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import RaspberryPi from '@/components/RaspberryPi/RaspberryPi';

export default function WelcomeSection() {
  return (
    <div
      id="welcome-section"
      className="bg-neutral-800 w-full flex flex-col items-center justify-center px-4 py-18 min-h-[calc(100vh-var(--header-height))]"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-screen-lg gap-6">
        <Typography variant="h2" component="h2" className="">
          Welcome to Abbottland.io
        </Typography>
        <HorizontalRule className="w-full" />
        <Typography variant="body1" component="p">
          Engineering field notes - homelab stories, software lessons, and the
          occasional wrong turn worth sharing
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Typography variant="h4" component="h4" className="mb-2">
              &gt; What this site is
            </Typography>
            <TransparentPanel color="primary" className="mb-4">
              <Typography variant="body1" component="p">
                I&apos;ve been building software professionally since 2010.
                Abbottland.io is where I write about the problems that stuck
                with me: building a Kubernetes cluster from bare metal, walking
                a friend through connecting React to an API, or untangling why
                my home network went sideways mid-project. Posts trace the arc
                from confusion to clarity, including the strategies that changed
                mid-way and the tools that both did and did not work out.
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
                Architecture Diagrams
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
                Homelab deep dives (Proxmox, Kubernetes, Ansible, Terraform),
                web development walkthroughs, and the occasional AI experiment,
                often as a series where each post picks up where the last one
                left off. The goal is less &quot;follow these steps&quot; and
                more &quot;here&apos;s how I thought through it, what broke, and
                what I learned.&quot; Come for the hot Kubernetes content. Stay
                for the architecture diagrams.
              </Typography>
            </TransparentPanel>
          </div>
        </div>

        <HorizontalRule className="w-full" />
      </div>
    </div>
  );
}
