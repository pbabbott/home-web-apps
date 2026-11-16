import { Typography } from '@abbottland/fui-components';

interface PlaceholderProps {
  title: string;
  /** h2 for a column heading, h3 (default) for a section within one. */
  level?: 'h2' | 'h3';
}

/** A not-yet-built section from the mockup. */
export function Placeholder({ title, level = 'h3' }: PlaceholderProps) {
  return (
    <section className="flex flex-col gap-3">
      <Typography variant={level} component={level}>
        {title}
      </Typography>
      <Typography variant="body2" className="text-neutral-400">
        Coming soon.
      </Typography>
    </section>
  );
}
