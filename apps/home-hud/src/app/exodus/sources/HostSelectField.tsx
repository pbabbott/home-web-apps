'use client';

import type { Host } from '../../infra/hosts/lib/homelab-api';

interface HostSelectFieldProps {
  hosts: Host[];
  value: string;
  onChange: (hostId: string) => void;
}

/** Picker over registered hosts; an empty value means no host is linked. */
export function HostSelectField({
  hosts,
  value,
  onChange,
}: HostSelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0"
    >
      <option value="">No host</option>
      {hosts.map((host) => (
        <option key={host.id} value={host.id}>
          {host.name} ({host.ipAddress})
        </option>
      ))}
    </select>
  );
}
