import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CubeIcon,
  LayersIcon,
  GridIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';

import { Badge } from '../../components/Badge/Badge';
import { CautionTape } from '../../components/CautionTape/CautionTape';
import { DataList } from '../../components/DataList/DataList';
import { HorizontalRule } from '../../components/HorizontalRule/HorizontalRule';
import { OutlinedButton } from '../../components/OutlinedButton/OutlinedButton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/Tabs/Tabs';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/Card/Card';
import { Comparator } from '../../components/Comparator/Comparator';
import { HexagonalBackground } from '../../components/HexagonalBackground/HexagonalBackground';
import { Input } from '../../components/Input/Input';
import { NavBar } from '../../components/NavBar/NavBar';
import { NavItem } from '../../components/NavItem/NavItem';
import { Panel } from '../../components/Panel/Panel';
import { Scrollbar } from '../../components/Scrollbar/Scrollbar';
import { SegmentedProgressBar } from '../../components/SegmentedProgressBar/SegmentedProgressBar';
import { StatusIndicator } from '../../components/StatusIndicator/StatusIndicator';
import { Switch } from '../../components/Switch/Switch';
import { TiledHexagons } from '../../components/TiledHexagons/TiledHexagons';
import { TransparentPanel } from '../../components/TransparentPanel/TransparentPanel';
import { Typography } from '../../components/Typography/Typography';

const meta: Meta = {
  title: 'Home',
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
};
export default meta;
type Story = StoryObj<typeof meta>;

const NAV = [
  { label: 'Components', icon: CubeIcon },
  { label: 'Showcase', icon: LayersIcon },
  { label: 'Tokens', icon: GridIcon },
];

const HEX = [
  { label: 'blog', lowerLabel: '8%', status: 'healthy' as const },
  { label: 'video-api', lowerLabel: '34%', status: 'warning' as const },
  { label: 'gluetun', lowerLabel: '95%', status: 'error' as const },
  { label: 'postgres', lowerLabel: '41%', status: 'healthy' as const },
];

const LOREM =
  'Corners, glows and hexagons: every surface in fui is built to feel like a heads-up display. Scroll this panel to try the custom scrollbar. ';

const SCROLL_HEIGHT = 120;

const ScrollPanel = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const [size, setSize] = useState(1);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const s = Math.min(el.clientHeight / el.scrollHeight, 1);
    const scrollable = el.scrollHeight - el.clientHeight;
    setSize(s);
    setPos((scrollable > 0 ? el.scrollTop / scrollable : 0) * (1 - s));
  };
  useEffect(sync, []);

  return (
    <Panel color="accent-purple" className="flex flex-row gap-2">
      <div
        ref={ref}
        onScroll={sync}
        style={{
          height: SCROLL_HEIGHT,
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
        className="flex-1"
      >
        <Typography variant="body2" className="text-neutral-200">
          {LOREM.repeat(8)}
        </Typography>
      </div>
      <Scrollbar
        height={SCROLL_HEIGHT}
        thumbPosition={pos}
        thumbSize={size}
        onThumbPositionChange={(p) => {
          const el = ref.current;
          if (!el) return;
          const room = 1 - size;
          const frac = room > 0 ? p / room : 0;
          el.scrollTop = frac * (el.scrollHeight - el.clientHeight);
        }}
      />
    </Panel>
  );
};

const LandingPage = () => {
  const [nav, setNav] = useState(0);
  const [hex, setHex] = useState(3);
  const [on, setOn] = useState(true);
  const [view, setView] = useState('grid');

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <HexagonalBackground />
      </div>
      <div className="relative z-10 grid min-h-screen gap-12 p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:p-16">
        <div className="flex flex-col justify-center gap-6">
          <Typography variant="h1" component="h1">
            fui components
          </Typography>
          <Typography variant="body1" className="text-primary-500">
            futuristic ui component library
          </Typography>
          <Typography variant="body2" className="max-w-md text-neutral-300">
            A React + Tailwind library of sci-fi flavoured building blocks:
            panels, hexagon grids, status lights, progress bars and more. Browse
            the live examples on the right, then dive into the sidebar.
          </Typography>
          <div className="flex flex-wrap gap-3">
            <Button
              component="a"
              href="?path=/story/buttons-navigation-button--default"
            >
              Browse components
            </Button>
            <Button
              variant="text"
              component="a"
              href="https://github.com/pbabbott/home-web-apps"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </Button>
          </div>
        </div>

        <TransparentPanel
          color="dark"
          className="flex flex-col gap-6 self-center p-6"
        >
          <NavBar>
            {NAV.map((n, i) => (
              <NavItem
                key={n.label}
                icon={n.icon}
                active={nav === i}
                onClick={() => setNav(i)}
              >
                {n.label}
              </NavItem>
            ))}
          </NavBar>

          <div className="flex flex-wrap items-center gap-3">
            <Badge color="primary">stable</Badge>
            <Badge color="success">healthy</Badge>
            <Badge color="warning">beta</Badge>
            <Badge color="accent-purple">new</Badge>
            <div className="ml-auto flex gap-2">
              {['grid', 'list', 'graph'].map((v) => (
                <OutlinedButton
                  key={v}
                  selected={view === v}
                  onClick={() => setView(v)}
                >
                  {v}
                </OutlinedButton>
              ))}
            </div>
          </div>

          <HorizontalRule />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-6">
              <TransparentPanel color="default" className="flex flex-col gap-4">
                <Input
                  color="primary"
                  placeholder="Search components"
                  aria-label="Search components"
                />
                <label className="flex items-center gap-3">
                  <Switch
                    checked={on}
                    onCheckedChange={setOn}
                    aria-label="Glow"
                  />
                  <Typography variant="body2">
                    Glow {on ? 'on' : 'off'}
                  </Typography>
                </label>
                <div className="flex items-center gap-3">
                  <Button>Deploy</Button>
                  <Button variant="text">
                    <span className="inline-flex items-center gap-2">
                      <MagnifyingGlassIcon /> Inspect
                    </span>
                  </Button>
                </div>
              </TransparentPanel>

              <div className="flex flex-col gap-2">
                <StatusIndicator color="success" status="online">
                  blog
                </StatusIndicator>
                <StatusIndicator color="warning" status="degraded">
                  video-api
                </StatusIndicator>
                <StatusIndicator color="error" status="offline">
                  gluetun
                </StatusIndicator>
              </div>

              <SegmentedProgressBar
                totalSegments={10}
                currentIndex={6}
                showLabel
                labelText="Deploying"
              />
              <Card
                color="primary"
                dotGrid
                onClick={() => {
                  window.location.search =
                    '?path=/story/layout-surfaces-panel--default';
                }}
              >
                <Typography variant="h5" component="h2">
                  Compose your HUD
                </Typography>
                <Typography variant="body2" className="text-neutral-300">
                  Panels, cards and hexagons that snap together. Click to open
                  the component docs.
                </Typography>
              </Card>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="-my-3 flex w-full origin-center scale-[0.78] justify-center">
                <Comparator
                  valueA="v1.42.0"
                  valueB="v1.42.0"
                  label="In Sync"
                  active
                />
              </div>
              <TiledHexagons
                maxHorizontal={2}
                tiles={HEX.map((t, i) => ({
                  ...t,
                  active: i === hex,
                  onClick: () => setHex(i),
                }))}
              />
              <div className="w-full">
                <Tabs defaultValue="host">
                  <TabsList>
                    <TabsTrigger value="host">Host</TabsTrigger>
                    <TabsTrigger value="net">Network</TabsTrigger>
                  </TabsList>
                  <TabsContent value="host">
                    <DataList.Root>
                      <DataList.Item>
                        <DataList.Label>Host</DataList.Label>
                        <DataList.Value color="success">
                          hogwarts
                        </DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Uptime</DataList.Label>
                        <DataList.Value>42 days</DataList.Value>
                      </DataList.Item>
                    </DataList.Root>
                  </TabsContent>
                  <TabsContent value="net">
                    <DataList.Root>
                      <DataList.Item>
                        <DataList.Label>Address</DataList.Label>
                        <DataList.Value>192.168.4.20</DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Latency</DataList.Label>
                        <DataList.Value color="warning">48 ms</DataList.Value>
                      </DataList.Item>
                    </DataList.Root>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>

          <ScrollPanel />

          <div className="relative h-16 overflow-hidden">
            <CautionTape label="under construction" />
          </div>
        </TransparentPanel>
      </div>
    </div>
  );
};

export const Landing: Story = {
  render: () => <LandingPage />,
};
