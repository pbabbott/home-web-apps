import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../../components/Badge/Badge';
import { ListItem } from '../../components/ListItem/ListItem';
import { ListItemButton } from '../../components/ListItemButton/ListItemButton';
import { Typography } from '../../components/Typography/Typography';

const ITEMS = [
  { id: '1', kind: 'directory', path: '\\\\NAS\\Photos\\2019' },
  { id: '2', kind: 'directory', path: '\\\\NAS\\Documents\\Taxes' },
  { id: '3', kind: 'file', path: '\\\\NAS\\Videos\\holiday-2020-final.mp4' },
  {
    id: '4',
    kind: 'file',
    path: '\\\\NAS\\Backups\\a\\very\\long\\path\\that\\should\\wrap\\onto\\more\\than\\one\\line\\archive.zip',
  },
] as const;

const meta = {
  title: 'Showcase/ListItem',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const kindColor = (kind: string) =>
  kind === 'directory' ? 'secondary' : 'dark';

/** A single-select pick-list, as in the Exodus "start backup" inventory picker. */
export const PickList: Story = {
  render: () => {
    const [selected, setSelected] = useState<string | null>('1');

    return (
      <div className="w-[480px]">
        <Typography variant="h5">Approved inventory</Typography>
        <div className="mt-2 flex flex-col">
          {ITEMS.map((item) => (
            <ListItemButton
              key={item.id}
              selected={item.id === selected}
              onClick={() => setSelected(item.id)}
              startAdornment={
                <Badge color={kindColor(item.kind)}>{item.kind}</Badge>
              }
            >
              {item.path}
            </ListItemButton>
          ))}
        </div>
      </div>
    );
  },
};

/** The static counterpart: read-only rows with a trailing value. */
export const StaticList: Story = {
  render: () => (
    <div className="w-[480px]">
      <ul className="flex list-none flex-col gap-1">
        {ITEMS.map((item) => (
          <ListItem
            key={item.id}
            color="primary"
            startAdornment={
              <Badge color={kindColor(item.kind)}>{item.kind}</Badge>
            }
          >
            {item.path}
          </ListItem>
        ))}
      </ul>
    </div>
  ),
};

const COLORS = [
  'neutral',
  'primary',
  'secondary',
  'success',
  'error',
  'warning',
  'accent-purple',
  'accent-falcon',
  'dark',
] as const;

/** Every color for both components, side by side. */
export const Colors: Story = {
  render: () => (
    <div className="w-[640px]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Typography variant="h6">ListItem</Typography>
        <Typography variant="h6">ListItemButton (selected)</Typography>
        <ul className="flex list-none flex-col">
          {COLORS.map((color) => (
            <ListItem key={color} color={color}>
              {color}
            </ListItem>
          ))}
        </ul>
        <div className="flex flex-col">
          {COLORS.map((color) => (
            <ListItemButton key={color} color={color} selected>
              {color}
            </ListItemButton>
          ))}
        </div>
      </div>
    </div>
  ),
};
