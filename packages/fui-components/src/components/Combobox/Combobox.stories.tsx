import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { within, userEvent } from 'storybook/test';
import { Combobox, type ComboboxOption } from './Combobox';

const meta: Meta = {
  title: 'Forms & Overlays/Combobox',
};
export default meta;
type Story = StoryObj<typeof meta>;

const payees: ComboboxOption[] = [
  'Amazon',
  'Costco',
  'Electric Company',
  'Farmers Market',
  'Gas Station',
  'Netflix',
  'Pharmacy',
  'Starbucks',
  'Target',
  'Trader Joe’s',
].map((name) => ({
  value: name.toLowerCase().replace(/\W+/g, '-'),
  label: name,
}));

const categories: ComboboxOption[] = [
  { value: 'rent', label: 'Rent', group: 'Bills' },
  { value: 'electric', label: 'Electric', group: 'Bills' },
  { value: 'internet', label: 'Internet', group: 'Bills' },
  { value: 'groceries', label: 'Groceries', group: 'Food' },
  { value: 'dining', label: 'Dining out', group: 'Food' },
  { value: 'coffee', label: 'Coffee', group: 'Food' },
  { value: 'fun', label: 'Fun money', group: 'Spending' },
];

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-center pt-8">{children}</div>
);

// Radix portals the popover out of #storybook-root, so screenshots would miss
// it. Open-state stories portal into this frame instead.
const OpenFrame = ({
  children,
}: {
  children: (container: HTMLElement | null) => React.ReactNode;
}) => {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  return (
    <div className="min-h-[440px]">
      <div className="flex justify-center pt-8">{children(container)}</div>
      <div ref={setContainer} />
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <Wrapper>
      <Combobox options={payees} placeholder="Payee" />
    </Wrapper>
  ),
};

export const Open: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Combobox
          defaultOpen
          options={payees}
          placeholder="Payee"
          container={container}
          animated={false}
        />
      )}
    </OpenFrame>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Combobox
          defaultOpen
          label="Payee"
          options={payees}
          placeholder="Payee"
          container={container}
          animated={false}
        />
      )}
    </OpenFrame>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Combobox
          defaultOpen
          options={categories}
          placeholder="Category"
          container={container}
          animated={false}
        />
      )}
    </OpenFrame>
  ),
};

export const Selected: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Combobox
          defaultOpen
          defaultValue="netflix"
          options={payees}
          placeholder="Payee"
          container={container}
          animated={false}
        />
      )}
    </OpenFrame>
  ),
};

export const WithClearOption: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Combobox
          defaultOpen
          options={payees}
          clearLabel="Any payee"
          placeholder="Payee"
          container={container}
          animated={false}
        />
      )}
    </OpenFrame>
  ),
};

export const Filtered: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Combobox
          defaultOpen
          options={categories}
          placeholder="Category"
          container={container}
          animated={false}
        />
      )}
    </OpenFrame>
  ),
  play: async ({ canvasElement }) => {
    // The popover is portaled into the frame inside the story root.
    const input = await within(canvasElement).findByPlaceholderText('Search…');
    await userEvent.type(input, 'fo');
  },
};

export const Empty: Story = {
  render: () => (
    <OpenFrame>
      {(container) => (
        <Combobox
          defaultOpen
          options={payees}
          placeholder="Payee"
          emptyText="No payees found"
          container={container}
          animated={false}
        />
      )}
    </OpenFrame>
  ),
  play: async ({ canvasElement }) => {
    const input = await within(canvasElement).findByPlaceholderText('Search…');
    await userEvent.type(input, 'zzzz');
  },
};

export const Small: Story = {
  render: () => (
    <Wrapper>
      <Combobox size="small" options={payees} placeholder="Payee" />
    </Wrapper>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Wrapper>
      <Combobox disabled options={payees} placeholder="Payee" />
    </Wrapper>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = React.useState<string | null>('target');
    return (
      <Wrapper>
        <Combobox
          options={payees}
          value={value}
          onValueChange={setValue}
          clearLabel="Any payee"
          placeholder="Payee"
        />
      </Wrapper>
    );
  },
};
