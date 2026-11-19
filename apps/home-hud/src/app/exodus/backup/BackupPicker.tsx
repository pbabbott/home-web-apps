'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Typography,
} from '@abbottland/fui-components';

interface Named {
  id: string;
  name: string;
}

/** Source and destination selectors; the choice lives in the URL, built by `urlFor`. */
export function BackupPicker({
  sources,
  destinations,
  sourceId,
  destinationId,
  urlFor,
}: {
  sources: Named[];
  destinations: Named[];
  sourceId: string;
  destinationId: string;
  urlFor: (sourceId: string, destinationId: string) => string;
}) {
  const router = useRouter();

  const picker = (
    label: string,
    options: Named[],
    selected: string,
    href: (id: string) => string,
  ) => (
    <div className="flex items-center gap-2">
      <Typography variant="small" className="text-neutral-400">
        {label}
      </Typography>
      <Select
        value={options.some((o) => o.id === selected) ? selected : ''}
        onValueChange={(id) => router.push(href(id))}
      >
        <SelectTrigger
          size="small"
          placeholder="None"
          className="min-w-[160px]"
        />
        <SelectContent label={label}>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-4">
      {picker('Source', sources, sourceId, (id) => urlFor(id, destinationId))}
      {picker('Destination', destinations, destinationId, (id) =>
        urlFor(sourceId, id),
      )}
    </div>
  );
}
