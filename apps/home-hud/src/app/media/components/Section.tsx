import {
  DataList,
  Typography,
  type DataListValueColor,
} from '@abbottland/fui-components';

// One label column width for the whole page so values line up from section to
// section; wide enough for the longest label ("gluetun-sync healthz").
const LABEL_WIDTH = '12rem';

interface SectionProps {
  title: string;
  /** False renders "Unavailable" in place of the rows. */
  available?: boolean;
  /** Small caption under the title. */
  note?: string;
  /** Content shown above the rows, e.g. a headline `StatusIndicator`. */
  before?: React.ReactNode;
  /** The label/value rows: `Row`s. */
  children: React.ReactNode;
  /** Content shown after the rows that isn't a label/value pair (lists, empty-state text). */
  after?: React.ReactNode;
}

export function Section({
  title,
  available = true,
  note,
  before,
  children,
  after,
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
        <>
          {before}
          <DataList.Root color="primary" size="small" className="max-w-md">
            {children}
          </DataList.Root>
          {after}
        </>
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
  /** State color for the value: success/error/warning, default for plain data. */
  color?: DataListValueColor;
}

/** One label/value line of a Section's DataList. */
export function Row({ label, children, color }: RowProps) {
  return (
    <DataList.Item>
      <DataList.Label width={LABEL_WIDTH}>{label}</DataList.Label>
      <DataList.Value color={color}>{children}</DataList.Value>
    </DataList.Item>
  );
}
