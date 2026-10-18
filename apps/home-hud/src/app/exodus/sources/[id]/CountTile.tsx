import { Typography } from '@abbottland/fui-components';

export function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 border border-neutral-700 px-3 py-2">
      <Typography variant="caption" className="text-neutral-400">
        {label}
      </Typography>
      <Typography variant="h5" component="span">
        {value}
      </Typography>
    </div>
  );
}
