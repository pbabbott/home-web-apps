'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  OutlinedButton,
} from '@abbottland/fui-components';
import type { Host } from '../../infra/hosts/lib/homelab-api';

interface HostSelectFieldProps {
  hosts: Host[];
  value: string;
  /** Hides the "No host" choice. */
  required?: boolean;
  onChange: (hostId: string) => void;
}

/** Picker over registered hosts; an empty value means no host is linked. */
export function HostSelectField({
  hosts,
  value,
  required = false,
  onChange,
}: HostSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = hosts.find((host) => host.id === value);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <OutlinedButton type="button" size="small">
          {selected
            ? `${selected.name} (${selected.ipAddress})`
            : required
              ? 'Select a host'
              : 'No host'}
        </OutlinedButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent label="Host">
        {!required && (
          <DropdownMenuItem onSelect={() => onChange('')}>
            No host
          </DropdownMenuItem>
        )}
        {hosts.map((host) => (
          <DropdownMenuItem key={host.id} onSelect={() => onChange(host.id)}>
            {host.name} ({host.ipAddress})
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
