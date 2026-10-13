'use server';

import type { Host, HostType } from './homelab-api';

const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

export interface CreateHostInput {
  name: string;
  ipAddress: string;
  hostType: HostType;
  instance?: string;
}

export async function createHost(input: CreateHostInput): Promise<Host> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`homelab-api POST /hosts returned ${res.status}: ${body}`);
  }

  return (await res.json()) as Host;
}

export async function deleteHost(id: string): Promise<void> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api DELETE /hosts/${id} returned ${res.status}: ${body}`,
    );
  }
}

export interface UpdateHostInput {
  name?: string;
  ipAddress?: string;
  hostType?: HostType;
  instance?: string | null;
}

export async function updateHost(
  id: string,
  input: UpdateHostInput,
): Promise<Host> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api PATCH /hosts/${id} returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as Host;
}
