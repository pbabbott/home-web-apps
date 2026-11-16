import { Typography } from '@abbottland/fui-components';

interface SectionProps {
  title: string;
  /** False renders "Unavailable" in place of the rows. */
  available?: boolean;
  /** Small caption under the title. */
  note?: string;
  children: React.ReactNode;
}

export function Section({
  title,
  available = true,
  note,
  children,
}: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <Typography variant="h3" component="h3">
        {title}
      </Typography>
      {note && (
        <Typography variant="small" className="text-neutral-400">
          {note}
        </Typography>
      )}
      {available ? (
        <dl className="m-0 flex max-w-md flex-col gap-2">{children}</dl>
      ) : (
        <Typography variant="body2" className="text-neutral-400">
          Unavailable.
        </Typography>
      )}
    </section>
  );
}

interface RowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** One label/value line; the value is right-aligned like the mockup. */
export function Row({ label, children, className }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt>
        <Typography variant="body2" component="span">
          {label}
        </Typography>
      </dt>
      <dd className="m-0 text-right">
        <Typography variant="body2" component="span" className={className}>
          {children}
        </Typography>
      </dd>
    </div>
  );
}

export const OK_CLASS = 'text-primary-600';
export const BAD_CLASS = 'text-error-400';
