import type { Meta, StoryObj } from '@storybook/react-vite';
import { Table, TableHead, TableBody, TableRow, Th, Td } from './Table';

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

export const WideTable: Story = {
  render: (args) => (
    <div style={{ maxWidth: 300 }}>
      <Table {...args}>
        <TableHead>
          <TableRow>
            <Th>Service</Th>
            <Th>Namespace</Th>
            <Th>Replicas</Th>
            <Th>CPU Request</Th>
            <Th>Memory Limit</Th>
            <Th>Status</Th>
            <Th>Last Deploy</Th>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <Td>api-gateway</Td>
            <Td>production</Td>
            <Td>3</Td>
            <Td>250m</Td>
            <Td>512Mi</Td>
            <Td>Running</Td>
            <Td>2025-05-26</Td>
          </TableRow>
          <TableRow>
            <Td>auth-service</Td>
            <Td>production</Td>
            <Td>2</Td>
            <Td>100m</Td>
            <Td>256Mi</Td>
            <Td>Running</Td>
            <Td>2025-05-24</Td>
          </TableRow>
          <TableRow>
            <Td>pi-led-api</Td>
            <Td>homelab</Td>
            <Td>1</Td>
            <Td>50m</Td>
            <Td>128Mi</Td>
            <Td>Running</Td>
            <Td>2025-05-20</Td>
          </TableRow>
          <TableRow>
            <Td>gluetun-sync</Td>
            <Td>homelab</Td>
            <Td>1</Td>
            <Td>50m</Td>
            <Td>64Mi</Td>
            <Td>CrashLoop</Td>
            <Td>2025-05-15</Td>
          </TableRow>
        </TableBody>
      </Table>
    </div>
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
