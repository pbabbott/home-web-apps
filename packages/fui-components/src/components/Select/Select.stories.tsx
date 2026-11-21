import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GlobeIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { Select, SelectTrigger, SelectContent, SelectItem } from './Select';

const meta: Meta = {
  title: 'Forms & Overlays/Select',
};
export default meta;
type Story = StoryObj<typeof meta>;

const Items = () => (
  <>
    <SelectItem value="public">Public</SelectItem>
    <SelectItem value="members">Members only</SelectItem>
    <SelectItem value="private">Private</SelectItem>
  </>
);

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-center pt-8">{children}</div>
);

// Radix portals the menu out of #storybook-root, so screenshots would miss it.
// Open-state stories portal into this frame instead.
const OpenFrame = ({
  children,
}: {
  children: (container: HTMLElement | null) => React.ReactNode;
}) => {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  return (
    <div className="min-h-[260px]">
      <div className="flex justify-center pt-8">{children(container)}</div>
      <div ref={setContainer} />
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <Wrapper>
      <Select>
        <SelectTrigger placeholder="Visibility" />
        <SelectContent>
          <Items />
        </SelectContent>
      </Select>
    </Wrapper>
  ),
};

export const Open: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Select defaultOpen defaultValue="members">
          <SelectTrigger placeholder="Visibility" />
          <SelectContent container={container} animated={false}>
            <Items />
          </SelectContent>
        </Select>
      )}
    </OpenFrame>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Select defaultOpen>
          <SelectTrigger placeholder="Visibility" />
          <SelectContent
            container={container}
            label="Select Visibility"
            animated={false}
          >
            <Items />
          </SelectContent>
        </Select>
      )}
    </OpenFrame>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Select defaultOpen defaultValue="public">
          <SelectTrigger placeholder="Visibility" />
          <SelectContent container={container} animated={false}>
            <SelectItem value="public" icon={GlobeIcon}>
              Public
            </SelectItem>
            <SelectItem value="members" icon={PersonIcon}>
              Members only
            </SelectItem>
            <SelectItem value="private" icon={LockClosedIcon}>
              Private
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </OpenFrame>
  ),
};

export const Selected: Story = {
  render: () => (
    <Wrapper>
      <Select defaultValue="private">
        <SelectTrigger placeholder="Visibility" />
        <SelectContent>
          <Items />
        </SelectContent>
      </Select>
    </Wrapper>
  ),
};

export const DisabledItem: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Select defaultOpen>
          <SelectTrigger placeholder="Visibility" />
          <SelectContent container={container} animated={false}>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="members" disabled>
              Members only
            </SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      )}
    </OpenFrame>
  ),
};

export const Small: Story = {
  render: () => (
    <Wrapper>
      <Select defaultValue="members">
        <SelectTrigger size="small" placeholder="Visibility" />
        <SelectContent>
          <Items />
        </SelectContent>
      </Select>
    </Wrapper>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Wrapper>
      <Select disabled defaultValue="public">
        <SelectTrigger placeholder="Visibility" />
        <SelectContent>
          <Items />
        </SelectContent>
      </Select>
    </Wrapper>
  ),
};

const ControlledDemo = () => {
  const [value, setValue] = React.useState('members');
  return (
    <Wrapper>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger placeholder="Visibility" />
        <SelectContent>
          <Items />
        </SelectContent>
      </Select>
    </Wrapper>
  );
};

export const Controlled: Story = {
  render: () => <ControlledDemo />,
};
