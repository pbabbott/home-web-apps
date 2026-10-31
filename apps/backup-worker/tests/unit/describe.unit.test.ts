import type { BackupDestinationWithHost } from '@abbottland/homelab-db';
import { describeDestinationRecord } from '../../src/destination/describe';

const destination = {
  id: 'dest-1',
  name: 'local test',
  hostId: 'host-1',
  host: { id: 'host-1', name: 'nas', ipAddress: '10.0.0.1' },
  connectionType: 'nfs',
  settings: { exportPath: '/tmp/dump' },
  rootDir: 'exodus',
  enabled: true,
  health: 'ok',
  lastValidatedAt: new Date('2026-10-31T20:00:00Z'),
  lastValidation: { ok: true },
  validationRequestedAt: null,
  workerSeenAt: new Date('2026-10-31T20:01:00Z'),
  claimedBy: 'worker-1',
  claimedUntil: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-31T20:00:00Z'),
} as BackupDestinationWithHost;

describe('describeDestinationRecord', () => {
  it('lists the record a worker manages, aligned, with dashes for empty values', () => {
    const lines = describeDestinationRecord(destination);

    expect(lines).toContain('settings.exportPath    /tmp/dump');
    expect(lines).toContain('host                   nas (10.0.0.1)');
    expect(lines).toContain('rootDir                exodus');
    expect(lines).toContain('lastValidatedAt        2026-10-31T20:00:00.000Z');
    expect(lines).toContain('validationRequestedAt  -');
    expect(lines).toContain('claimedUntil           -');
  });
});
