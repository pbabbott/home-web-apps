import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from './DropdownMenu';
import { DirectoryMenuItems } from '../../stories/shared/DirectoryMenuItems';

const meta: Meta = {
  title: 'Components/DropdownMenu',
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

const OpenDemo = () => (
  <div className="flex justify-center pt-8">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger className="bg-transparent border-0 p-0 cursor-pointer outline-none text-button uppercase text-primary-500">
        More
      </DropdownMenuTrigger>
      <DropdownMenuContent label="Interface Directory" showClose>
        <DirectoryMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export const Open: Story = {
  render: () => <OpenDemo />,
};
