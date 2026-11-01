import type { ReactNode } from 'react';
import { Typography } from '@abbottland/fui-components';

export function Section({
  title,
  empty,
  children,
}: {
  title: ReactNode;
  /** Shown instead of `children` when set. */
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      {empty ? (
        <Typography variant="body2" className="text-neutral-400">
          {empty}
        </Typography>
      ) : (
        children
      )}
    </section>
  );
}
