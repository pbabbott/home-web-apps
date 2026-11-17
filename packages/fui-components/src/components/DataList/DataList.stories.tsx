import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  DataList,
  type DataListAlign,
  type DataListColor,
  type DataListRootProps,
  type DataListValueColor,
} from './DataList';

const meta = {
  title: 'Data Display/DataList',
  component: DataList.Root,
  parameters: { layout: 'centered' },
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    size: { control: 'radio', options: ['default', 'small'] },
    color: { control: 'select', options: ['primary', 'secondary', 'neutral'] },
  },
} satisfies Meta<typeof DataList.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[28rem]">{children}</div>
);

const Basic = (args: DataListRootProps) => (
  <Wrapper>
    <DataList.Root {...args}>
      <DataList.Item>
        <DataList.Label>Host</DataList.Label>
        <DataList.Value>hogwarts</DataList.Value>
      </DataList.Item>
      <DataList.Item>
        <DataList.Label>Address</DataList.Label>
        <DataList.Value>192.168.4.20</DataList.Value>
      </DataList.Item>
      <DataList.Item>
        <DataList.Label>Uptime</DataList.Label>
        <DataList.Value>41 days 06 hrs</DataList.Value>
      </DataList.Item>
    </DataList.Root>
  </Wrapper>
);

export const Default: Story = { render: (args) => <Basic {...args} /> };

export const OrientationHorizontal: Story = {
  args: { orientation: 'horizontal' },
  render: (args) => <Basic {...args} />,
};
export const OrientationVertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => <Basic {...args} />,
};

export const SizeDefault: Story = {
  args: { size: 'default' },
  render: (args) => <Basic {...args} />,
};
export const SizeSmall: Story = {
  args: { size: 'small' },
  render: (args) => <Basic {...args} />,
};

const colorStory = (color: DataListColor): Story => ({
  args: { color },
  render: (args) => <Basic {...args} />,
});
export const ColorPrimary = colorStory('primary');
export const ColorSecondary = colorStory('secondary');
export const ColorNeutral = colorStory('neutral');

const ALIGNS: DataListAlign[] = [
  'start',
  'center',
  'end',
  'baseline',
  'stretch',
];

export const ItemAlign: Story = {
  render: (args) => (
    <Wrapper>
      <DataList.Root {...args}>
        {ALIGNS.map((align) => (
          <DataList.Item key={align} align={align}>
            <DataList.Label>{align}</DataList.Label>
            <DataList.Value>
              <span className="inline-block">
                Wrapped value
                <br />
                on two lines
              </span>
            </DataList.Value>
          </DataList.Item>
        ))}
      </DataList.Root>
    </Wrapper>
  ),
};

export const LabelWidth: Story = {
  render: (args) => (
    <Wrapper>
      <DataList.Root {...args}>
        <DataList.Item>
          <DataList.Label width="4rem">Narrow</DataList.Label>
          <DataList.Value>4rem label column</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label width="14rem">Wide label column</DataList.Label>
          <DataList.Value>14rem label column</DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </Wrapper>
  ),
};

const VALUE_COLORS: DataListValueColor[] = [
  'default',
  'primary',
  'success',
  'warning',
  'error',
];

export const ValueColors: Story = {
  render: (args) => (
    <Wrapper>
      <DataList.Root {...args}>
        {VALUE_COLORS.map((color) => (
          <DataList.Item key={color}>
            <DataList.Label>{color}</DataList.Label>
            <DataList.Value color={color}>{color}</DataList.Value>
          </DataList.Item>
        ))}
      </DataList.Root>
    </Wrapper>
  ),
};
