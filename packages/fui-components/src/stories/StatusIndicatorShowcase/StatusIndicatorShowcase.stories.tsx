import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusIndicator } from '../../components/StatusIndicator/StatusIndicator';
import { TransparentPanel } from '../../components/TransparentPanel/TransparentPanel';
import { Typography } from '../../components/Typography/Typography';

const meta = {
  title: 'Showcase/StatusIndicator',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const SERVERS = [
  { name: 'hogwarts', color: 'success' },
  { name: 'chimaera', color: 'success' },
  { name: 'room_of_requirement', color: 'success' },
  { name: 'bananapi', color: 'warning' },
  { name: 'dumbledore', color: 'error' },
] as const;

const ENDPOINTS = [
  { url: 'abbottland.io', status: '200 OK', color: 'success' },
  { url: 'blog.abbottland.io', status: '200 OK', color: 'success' },
  { url: 'plex.local.abbottland.io', status: '301', color: 'warning' },
  { url: 'hud.local.abbottland.io', status: '503', color: 'error' },
  { url: 'old.abbottland.io', status: '404', color: 'error' },
] as const;

/** Stacked rows with glowing dots: color alone shows what is up at a glance. */
export const ServersWithDots: Story = {
  render: () => (
    <TransparentPanel className="w-96 p-4">
      <Typography variant="h3" component="h3">
        Hosts
      </Typography>
      <ul className="mt-3 flex list-none flex-col gap-1 p-0">
        {SERVERS.map((s) => (
          <StatusIndicator key={s.name} color={s.color} aria-label={s.name}>
            {s.name}
          </StatusIndicator>
        ))}
      </ul>
    </TransparentPanel>
  ),
};

/** The same rows with status text (HTTP codes) in place of the dot. */
export const EndpointsWithStatusText: Story = {
  render: () => (
    <TransparentPanel className="w-96 p-4">
      <Typography variant="h3" component="h3">
        Endpoints
      </Typography>
      <ul className="mt-3 flex list-none flex-col gap-1 p-0">
        {ENDPOINTS.map((e) => (
          <StatusIndicator key={e.url} color={e.color} status={e.status}>
            {e.url}
          </StatusIndicator>
        ))}
      </ul>
    </TransparentPanel>
  ),
};
