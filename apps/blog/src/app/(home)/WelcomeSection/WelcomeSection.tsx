'use client';

import Link from 'next/link';
import {
  OutlinedButton,
  HorizontalRule,
  TransparentPanel,
  Typography,
  type DiagramViewerProps,
} from '@abbottland/fui-components';
import { DiagramViewer } from '@/components/diagram';
import diagram01 from '../../system-architecture/diagram-01.json';

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
        <HorizontalRule className="w-full" />
        <Typography variant="body1" component="p">
          Engineering field notes - homelab stories, software lessons, and the
          occasional wrong turn worth sharing
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <div className="flex flex-col gap-6">
            <div>
              <Typography variant="h4" component="h4" className="mb-2">
                &gt; What this site is
              </Typography>
              <TransparentPanel color="primary">
                <Typography variant="body1" component="p">
                  I&apos;ve been building software professionally since 2010.
                  Abbottland.io is where I write about the problems that stuck
                  with me: building a Kubernetes cluster from bare metal,
                  walking a friend through connecting React to an API, or
                  untangling why my home network went sideways mid-project.
                  Posts trace the arc from confusion to clarity, including the
                  strategies that changed mid-way and the tools that both did
                  and did not work out.
                </Typography>
              </TransparentPanel>
            </div>

            <div>
              <Typography variant="h4" component="h4" className="mb-2">
                &gt; What you&apos;ll find here
              </Typography>
              <TransparentPanel color="secondary">
                <Typography variant="body1" component="p">
                  Homelab deep dives (Proxmox, Kubernetes, Ansible, Terraform),
                  web development walkthroughs, and the occasional AI
                  experiment, often as a series where each post picks up where
                  the last one left off. The goal is less &quot;follow these
                  steps&quot; and more &quot;here&apos;s how I thought through
                  it, what broke, and what I learned.&quot; Come for the hot
                  Kubernetes content. Stay for the architecture diagrams.
                </Typography>
              </TransparentPanel>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Typography variant="h4" component="h4">
              &gt; How it all fits together
            </Typography>
            <Typography
              variant="caption"
              component="p"
              className="text-neutral-500"
            >
              A Bird&apos;s-eye view of the homelab: one cluster, one user. The
              full map goes three levels deep if you want to dig in.
            </Typography>
            <div className="border border-neutral-700 bg-neutral-900">
              <DiagramViewer
                data={diagram01 as DiagramViewerProps['data']}
                height="360px"
                name="System Context"
              />
            </div>

            <div className="flex flex-col items-center gap-3">
              <Typography
                variant="body1"
                component="p"
                className="text-neutral-400"
              >
                Curious how this site is built?
              </Typography>
              <OutlinedButton
                component={Link}
                href="/system-architecture"
                color="primary"
              >
                &gt; Inspect System Architecture
              </OutlinedButton>
            </div>
          </div>
        </div>

        <HorizontalRule className="w-full" />
      </div>
    </div>
  );
}
