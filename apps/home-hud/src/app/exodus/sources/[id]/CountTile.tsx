import { TransparentPanel, Typography } from '@abbottland/fui-components';

type CountTileColor = Parameters<typeof TransparentPanel>[0]['color'];

export function CountTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: CountTileColor;
}) {
  return (
    <TransparentPanel color={color} className="flex flex-col gap-0.5">
      <Typography variant="caption">{label}</Typography>
      <Typography variant="h5" component="span">
        {value}
      </Typography>
    </TransparentPanel>
  );
}
