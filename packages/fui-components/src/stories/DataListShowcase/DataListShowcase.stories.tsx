import type { StoryObj } from '@storybook/react-vite';
import { DataList } from '../../components/DataList/DataList';
import { TransparentPanel } from '../../components/TransparentPanel/TransparentPanel';
import { Typography } from '../../components/Typography/Typography';
import { Badge } from '../../components/Badge/Badge';

const Panel = ({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <TransparentPanel color="dark" className={`p-6 ${className ?? ''}`}>
    <Typography variant="h4" component="h4" className="mb-4">
      {title}
    </Typography>
    {children}
  </TransparentPanel>
);

const meta = {
  title: 'Showcase/DataList',
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const HostStatus: Story = {
  render: () => (
    <TransparentPanel color="dark" className="w-[32rem] p-6">
      <Typography variant="h4" component="h4" className="mb-4">
        hogwarts
      </Typography>
      <DataList.Root color="primary" size="small">
        <DataList.Item align="center">
          <DataList.Label>Status</DataList.Label>
          <DataList.Value color="success">
            <Badge color="success">Online</Badge>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Role</DataList.Label>
          <DataList.Value>Proxmox primary</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Address</DataList.Label>
          <DataList.Value>192.168.4.20</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Disk</DataList.Label>
          <DataList.Value color="warning">82% used</DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </TransparentPanel>
  ),
};

/** Status readouts (state colors, badges, wrapping text), then the same readout across orientation, size and alignment. */
export const StatusAndLayouts: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => {
    const Rows = () => (
      <>
        <DataList.Item>
          <DataList.Label>Pod</DataList.Label>
          <DataList.Value>qbittorrent-vpn</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Node</DataList.Label>
          <DataList.Value>gen3-worker-3</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Restarts</DataList.Label>
          <DataList.Value color="warning">12</DataList.Value>
        </DataList.Item>
      </>
    );

    return (
      <div className="grid grid-cols-3 gap-6 p-6">
        <Panel title="Sync Attempt">
          <DataList.Root color="primary" size="small">
            <DataList.Item>
              <DataList.Label width="6rem">Status</DataList.Label>
              <DataList.Value color="success">Success</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label width="6rem">Source</DataList.Label>
              <DataList.Value>CRON</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label width="6rem">Time</DataList.Label>
              <DataList.Value>
                2024-12-24 2:20 PM
                <br />4 hours ago
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Panel>
        <Panel title="Service Status">
          <DataList.Root color="secondary" size="small">
            <DataList.Item align="center">
              <DataList.Label width="9rem">gluetun-sync</DataList.Label>
              <DataList.Value color="success">
                <Badge color="success">OK</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label width="9rem">qbittorrent</DataList.Label>
              <DataList.Value color="warning">
                <Badge color="warning">Degraded</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label width="9rem">gluetun</DataList.Label>
              <DataList.Value color="error">
                <Badge color="error">Down</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label width="9rem">sonarr</DataList.Label>
              <DataList.Value>—</DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Panel>
        <Panel title="Last Failure">
          <DataList.Root color="neutral" size="small">
            <DataList.Item>
              <DataList.Label width="6rem">Time</DataList.Label>
              <DataList.Value>
                2024-12-24 2:20 PM
                <br />4 hours ago
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label width="6rem">Error</DataList.Label>
              <DataList.Value color="error" className="break-words">
                Could not log into qbittorrent
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Panel>

        <Panel title="Horizontal">
          <DataList.Root color="primary">
            <Rows />
          </DataList.Root>
        </Panel>
        <Panel title="Horizontal small">
          <DataList.Root color="secondary" size="small">
            <Rows />
          </DataList.Root>
        </Panel>
        <Panel title="Vertical">
          <DataList.Root orientation="vertical" color="neutral">
            <Rows />
          </DataList.Root>
        </Panel>
        <Panel title="Vertical small">
          <DataList.Root orientation="vertical" color="primary" size="small">
            <Rows />
          </DataList.Root>
        </Panel>
        <Panel title="Wide labels">
          <DataList.Root color="secondary" size="small">
            <DataList.Item>
              <DataList.Label width="14rem">
                gluetun-sync healthz
              </DataList.Label>
              <DataList.Value color="success">OK</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label width="14rem">Free on media share</DataList.Label>
              <DataList.Value>16.6 TiB</DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Panel>
        <Panel title="Mixed alignment">
          <DataList.Root color="neutral" size="small">
            <DataList.Item align="center">
              <DataList.Label>Status</DataList.Label>
              <DataList.Value>
                <Badge color="success">Online</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="start">
              <DataList.Label>Notes</DataList.Label>
              <DataList.Value>
                Two lines
                <br />
                aligned to the top
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Panel>
      </div>
    );
  },
};
