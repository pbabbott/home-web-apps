import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChevronRightIcon,
  CubeIcon,
  ExternalLinkIcon,
  QuestionMarkCircledIcon,
  StackIcon,
} from '@radix-ui/react-icons';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from './DropdownMenu';
import { DropdownMenuItem } from './DropdownMenuItem';
import { DirectoryMenuItems } from '../../stories/shared/DirectoryMenuItems';

const meta: Meta = {
  title: 'Forms & Overlays/DropdownMenu',
};
export default meta;
type Story = StoryObj<typeof meta>;

const DefaultDemo = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex justify-center pt-8">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className={extendedTwMerge(
            'bg-transparent border-0 p-0 cursor-pointer outline-none text-button uppercase transition-colors duration-300',
            open ? 'text-primary-500' : 'text-neutral-300',
          )}
        >
          More
        </DropdownMenuTrigger>
        <DropdownMenuContent label="Interface Directory" showClose>
          <DirectoryMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const Default: Story = {
  render: () => <DefaultDemo />,
};

// Radix portals the menu out of #storybook-root, so screenshots would miss it.
// Open-state stories portal into this frame instead.
const OpenFrame = ({
  children,
}: {
  children: (container: HTMLElement | null) => React.ReactNode;
}) => {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  return (
    <div className="min-h-[320px]">
      <div className="flex justify-center pt-8">{children(container)}</div>
      <div ref={setContainer} />
    </div>
  );
};

const OpenTrigger = () => (
  <DropdownMenuTrigger className="bg-transparent border-0 p-0 cursor-pointer outline-none text-button uppercase text-primary-500">
    More
  </DropdownMenuTrigger>
);

export const Open: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <DropdownMenu defaultOpen>
          <OpenTrigger />
          <DropdownMenuContent
            label="Interface Directory"
            showClose
            animated={false}
            container={container}
          >
            <DirectoryMenuItems />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </OpenFrame>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <DropdownMenu defaultOpen>
          <OpenTrigger />
          <DropdownMenuContent
            label="Interface Directory"
            animated={false}
            container={container}
          >
            <DirectoryMenuItems />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </OpenFrame>
  ),
};

export const WithoutLabel: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <DropdownMenu defaultOpen>
          <OpenTrigger />
          <DropdownMenuContent animated={false} container={container}>
            <DirectoryMenuItems />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </OpenFrame>
  ),
};

export const WithoutIcons: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <DropdownMenu defaultOpen>
          <OpenTrigger />
          <DropdownMenuContent
            label="Actions"
            animated={false}
            container={container}
          >
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem>Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </OpenFrame>
  ),
};

export const RightIcons: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <DropdownMenu defaultOpen>
          <OpenTrigger />
          <DropdownMenuContent
            label="Interface Directory"
            animated={false}
            container={container}
          >
            <DropdownMenuItem icon={StackIcon} rightIcon={ChevronRightIcon}>
              Series
            </DropdownMenuItem>
            <DropdownMenuItem icon={CubeIcon} rightIcon={ExternalLinkIcon}>
              FUI Components
            </DropdownMenuItem>
            <DropdownMenuItem icon={QuestionMarkCircledIcon}>
              System Architecture
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </OpenFrame>
  ),
};

export const DisabledItem: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <DropdownMenu defaultOpen>
          <OpenTrigger />
          <DropdownMenuContent
            label="Interface Directory"
            animated={false}
            container={container}
          >
            <DropdownMenuItem icon={StackIcon}>Series</DropdownMenuItem>
            <DropdownMenuItem icon={CubeIcon} disabled>
              FUI Components
            </DropdownMenuItem>
            <DropdownMenuItem icon={QuestionMarkCircledIcon}>
              System Architecture
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </OpenFrame>
  ),
};
