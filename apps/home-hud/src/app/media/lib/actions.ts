'use server';

import { getGluetunSyncLogs } from './homelab-api';

const GLUETUN_SYNC_URL =
  process.env.GLUETUN_SYNC_URL ?? 'http://localhost:4000';

export interface SyncPortsResult {
  success: boolean;
  message: string;
}

/**
 * Triggers gluetun-sync's `POST /sync`. A failed sync (502) still carries a
 * `message`, so it's returned rather than thrown.
 */
export async function syncPorts(): Promise<SyncPortsResult> {
  try {
    const res = await fetch(`${GLUETUN_SYNC_URL}/sync`, {
      method: 'POST',
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `gluetun-sync POST /sync returned ${res.status}`;
    return { success: res.ok, message };
  } catch (err) {
    console.error('Failed to call gluetun-sync POST /sync:', err);
    return { success: false, message: 'Could not reach gluetun-sync' };
  }
}

/** Re-reads the gluetun-sync logs for the Refresh button; `null` when they can't be loaded. */
export async function refreshGluetunSyncLogs(): Promise<string[] | null> {
  try {
    return await getGluetunSyncLogs();
  } catch (err) {
    console.error('Failed to load gluetun-sync logs from homelab-api:', err);
    return null;
  }
}
