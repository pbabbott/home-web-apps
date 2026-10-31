import type { BackupDestinationWithHost } from '@abbottland/homelab-db';

const iso = (value: Date | null): string => (value ? value.toISOString() : '-');

/**
 * The database record this worker manages, one `field: value` line each, for
 * the console. Printed next to the environment variables so a mismatch between
 * the two (the export the record expects vs the path the worker writes to) is
 * visible without opening the database. Holds no secrets.
 */
export const describeDestinationRecord = (
  destination: BackupDestinationWithHost,
): string[] => {
  const fields: [string, string][] = [
    ['id', destination.id],
    ['name', destination.name],
    ['host', `${destination.host.name} (${destination.host.ipAddress})`],
    ['connectionType', destination.connectionType],
    ['settings.exportPath', destination.settings.exportPath],
    ['rootDir', destination.rootDir ?? '-'],
    ['enabled', String(destination.enabled)],
    ['health', destination.health],
    ['lastValidatedAt', iso(destination.lastValidatedAt)],
    ['validationRequestedAt', iso(destination.validationRequestedAt)],
    ['workerSeenAt', iso(destination.workerSeenAt)],
    ['claimedBy', destination.claimedBy ?? '-'],
    ['claimedUntil', iso(destination.claimedUntil)],
    ['updatedAt', iso(destination.updatedAt)],
  ];
  const width = Math.max(...fields.map(([name]) => name.length));

  return fields.map(([name, value]) => `${name.padEnd(width)}  ${value}`);
};
