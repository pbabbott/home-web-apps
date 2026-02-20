import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  Th,
  Td,
} from './Table';

const meta = {
  title: 'Components/Table',
  component: Table,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'neutral'],
    },
  },
  args: {
    color: 'primary',
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHead>
        <TableRow>
          <Th>Column A</Th>
          <Th>Column B</Th>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <Td>Cell 1</Td>
          <Td>Cell 2</Td>
        </TableRow>
        <TableRow>
          <Td>Cell 3</Td>
          <Td>Cell 4</Td>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const MultiColumn: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHead>
        <TableRow>
          <Th>Problem</Th>
          <Th>Possible solution</Th>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <Td>Singular production cluster is brittle</Td>
          <Td>Build a 2nd cluster using flux to maximize re-use</Td>
        </TableRow>
        <TableRow>
          <Td>ingress-nginx is no longer supported</Td>
          <Td>Introduce Istio during cluster rebuild</Td>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const Secondary: Story = {
  render: (args) => (
    <Table {...args} color="secondary">
      <TableHead>
        <TableRow>
          <Th color="secondary">URL</Th>
          <Th color="secondary">Cluster</Th>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <Td color="secondary">*.abbottland.io</Td>
          <Td color="secondary">Existing Cluster</Td>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
