import type { Meta, StoryObj } from '@storybook/react-vite';
import { CubeIcon, FileTextIcon } from '@radix-ui/react-icons';

import { ConnectedNav, type ConnectedNavItem } from './ConnectedNav';

const subItems: ConnectedNavItem[] = [
  { id: 'blog', label: 'Blog', icon: FileTextIcon },
  { id: 'portfolio', label: 'Portfolio', icon: FileTextIcon },
  { id: 'designs', label: 'Designs', icon: FileTextIcon },
];

const items: ConnectedNavItem[] = [
  { id: 'home', label: 'Home', icon: CubeIcon, children: subItems },
  { id: 'other', label: 'Other', icon: CubeIcon, children: subItems },
  { id: 'plain', label: 'Plain', icon: CubeIcon },
];

const meta = {
  title: 'Buttons & Navigation/ConnectedNav',
  component: ConnectedNav,
  parameters: { layout: 'centered' },
  args: { items, spark: false },
  decorators: [
    (Story) => (
      <div className="w-[640px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectedNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondItemSelected: Story = {
  args: { defaultValue: 'other' },
};

export const NoChildren: Story = {
  args: { defaultValue: 'plain' },
};

export const WithSpark: Story = {
  args: { spark: true, color: 'primary' },
};
