import type { StoryObj } from '@storybook/react-vite';
import { Comparator } from '../../components/Comparator/Comparator';
import { TransparentPanel } from '../../components/TransparentPanel/TransparentPanel';
import { Typography } from '../../components/Typography/Typography';

const meta = {
  title: 'Showcase/Comparator',
};

export default meta;
type Story = StoryObj<typeof meta>;

const Panel = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <TransparentPanel color="dark" className="p-6">
    <Typography variant="h4" component="h4" className="mb-4">
      {title}
    </Typography>
    {children}
    {note && (
      <Typography variant="body2" className="mt-4 text-neutral-400">
        {note}
      </Typography>
    )}
  </TransparentPanel>
);

/** Sync states and color meaning, side by side. */
export const StatesAndColors: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="grid grid-cols-2 gap-6 p-6">
      <Panel title="In sync (active)">
        <Comparator
          valueA="38907"
          valueB="38907"
          captionA="Gluetun"
          captionB="qBittorrent"
          label="Synchronized"
          active
          className="pt-8"
        />
      </Panel>
      <Panel title="Out of sync">
        <Comparator
          valueA="38907"
          valueB="38911"
          captionA="Gluetun"
          captionB="qBittorrent"
          label="Out of sync"
          className="pt-8"
        />
      </Panel>
      <Panel
        title="Missing value"
        note="Both ports read 0 (no forwarded port yet), so equal text does not count as a match."
      >
        <Comparator
          valueA="unknown"
          valueB="unknown"
          inSync={false}
          captionA="Gluetun"
          captionB="qBittorrent"
          label="Out of sync"
          className="pt-8"
        />
      </Panel>
      <Panel
        title="Difference is healthy"
        note="Traffic should leave through the VPN: the connector breaks but keeps the primary color."
      >
        <Comparator
          valueA="68.46.10.76"
          valueB="149.36.49.159"
          inSync={false}
          color="primary"
          captionA="Home IP"
          captionB="VPN IP"
          label="Not matched"
          className="pt-8"
        />
      </Panel>
      <Panel title="Color error, in sync">
        <Comparator
          valueA="v1.7.3"
          valueB="v1.7.3"
          color="error"
          captionA="Running"
          captionB="Pinned"
          label="Pinned to an old release"
          className="pt-8"
        />
      </Panel>
      <Panel title="No label or captions">
        <Comparator valueA="4" valueB="4" className="pt-2" />
      </Panel>
    </div>
  ),
};
