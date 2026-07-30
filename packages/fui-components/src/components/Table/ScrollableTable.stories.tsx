import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollableTable } from './Table';

const meta = {
  title: 'Components/ScrollableTable',
  component: ScrollableTable,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ScrollableTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div style={{ maxWidth: 300 }}>
      <ScrollableTable {...args}>
        <table className="border border-collapse w-full border-neutral-500">
          <thead>
            <tr>
              <th className="border border-neutral-500 px-3 py-2 text-left">
                Service
              </th>
              <th className="border border-neutral-500 px-3 py-2 text-left">
                Namespace
              </th>
              <th className="border border-neutral-500 px-3 py-2 text-left">
                Replicas
              </th>
              <th className="border border-neutral-500 px-3 py-2 text-left">
                CPU Request
              </th>
              <th className="border border-neutral-500 px-3 py-2 text-left">
                Memory Limit
              </th>
              <th className="border border-neutral-500 px-3 py-2 text-left">
                Status
              </th>
              <th className="border border-neutral-500 px-3 py-2 text-left">
                Last Deploy
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-neutral-500 px-3 py-2">
                api-gateway
              </td>
              <td className="border border-neutral-500 px-3 py-2">
                production
              </td>
              <td className="border border-neutral-500 px-3 py-2">3</td>
              <td className="border border-neutral-500 px-3 py-2">250m</td>
              <td className="border border-neutral-500 px-3 py-2">512Mi</td>
              <td className="border border-neutral-500 px-3 py-2">Running</td>
              <td className="border border-neutral-500 px-3 py-2">
                2025-05-26
              </td>
            </tr>
            <tr>
              <td className="border border-neutral-500 px-3 py-2">
                auth-service
              </td>
              <td className="border border-neutral-500 px-3 py-2">
                production
              </td>
              <td className="border border-neutral-500 px-3 py-2">2</td>
              <td className="border border-neutral-500 px-3 py-2">100m</td>
              <td className="border border-neutral-500 px-3 py-2">256Mi</td>
              <td className="border border-neutral-500 px-3 py-2">Running</td>
              <td className="border border-neutral-500 px-3 py-2">
                2025-05-24
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  ),
};
