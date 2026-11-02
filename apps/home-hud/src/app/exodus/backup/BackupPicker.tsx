'use client';

import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  OutlinedButton,
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <OutlinedButton type="button" size="small">
            {options.find((o) => o.id === selected)?.name ?? 'None'}
          </OutlinedButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={label}>
          {options.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => router.push(href(option.id))}
            >
              {option.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
