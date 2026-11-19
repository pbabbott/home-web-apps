'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@abbottland/fui-components';
import type { Host } from '../../infra/hosts/lib/homelab-api';

// Radix Select rejects an empty item value, so "No host" uses this sentinel.
const NONE = '__none__';

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
  const selected = hosts.find((host) => host.id === value);

  return (
    <Select
      // '' shows the placeholder (required and nothing picked yet).
      value={selected ? selected.id : required ? '' : NONE}
      onValueChange={(next) => onChange(next === NONE ? '' : next)}
    >
      <SelectTrigger
        aria-label="Host"
        size="small"
        placeholder="Select a host"
        className="min-w-[200px]"
      />
      <SelectContent label="Host">
        {!required && <SelectItem value={NONE}>No host</SelectItem>}
        {hosts.map((host) => (
          <SelectItem key={host.id} value={host.id}>
            {host.name} ({host.ipAddress})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
