import { Typography } from '@abbottland/fui-components';

export function Footer() {
  return (
    <div className="px-3 py-1 text-right bg-neutral-950">
      <Typography variant="caption" className="text-neutral-600">
        {process.env.IMAGE_TAG ?? 'dev'}
      </Typography>
    </div>
  );
}
