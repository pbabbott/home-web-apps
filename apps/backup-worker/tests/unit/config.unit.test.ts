import {
  ApplicationConfig,
  findConfigProblems,
  formatConfigStatus,
} from '../../src/config';

const good = (): ApplicationConfig => {
  const cfg = new ApplicationConfig();
  cfg.exodusCredentialKey = Buffer.alloc(32, 1).toString('base64');
  cfg.backupDestinationId = '6f1c2b0e-3a4d-4c5e-8f90-123456789abc';
  cfg.backupDestinationPath = '/backup';
  return cfg;
};

describe('findConfigProblems', () => {
  it('accepts a valid config with the documented defaults', () => {
    const cfg = good();

    expect(findConfigProblems(cfg)).toEqual([]);
    expect(cfg.backupDestinationMountCheck).toBe('nfs');
    expect(cfg.backupParallelism).toBe(1);
    expect(cfg.backupStallTimeoutSeconds).toBe(120);
    expect(cfg.backupHeartbeatSeconds).toBe(60);
    expect(cfg.backupLeaseSeconds).toBe(300);
  });

  it("polls well inside the API's two-minute staleness window", () => {
    expect(new ApplicationConfig().pollIntervalMs).toBeLessThan(60_000);
  });

  it.each([
    ['backupDestinationId', 'not-a-uuid', /BACKUP_DESTINATION_ID/],
    ['backupDestinationPath', 'relative/path', /BACKUP_DESTINATION_PATH/],
    ['backupDestinationMountCheck', 'smb', /MOUNT_CHECK/],
    ['exodusCredentialKey', 'c2hvcnQ=', /EXODUS_CREDENTIAL_KEY/],
    ['backupStallTimeoutSeconds', 0, /BACKUP_STALL_TIMEOUT_SECONDS/],
    ['pollIntervalMs', 1.5, /POLL_INTERVAL_MS/],
  ])('rejects bad %s', (field, value, message) => {
    const cfg = good();
    (cfg as unknown as Record<string, unknown>)[field] = value;

    expect(findConfigProblems(cfg)).toEqual([expect.stringMatching(message)]);
  });
});

describe('formatConfigStatus', () => {
  const status = (envVarName: string, isMissing: boolean) => ({
    path: envVarName,
    envVarName,
    isSet: false,
    isMissing,
    isSensitive: false,
    value: '',
  });

  it('reports the optional destination pin as optional, not required', () => {
    const lines = formatConfigStatus([
      status('BACKUP_DESTINATION_ID', true),
      status('BACKUP_DESTINATION_PATH', true),
    ]);

    expect(lines[0]).toMatch(/BACKUP_DESTINATION_ID\s+not set \(optional\)/);
    expect(lines[0]).not.toMatch(/required/);
    expect(lines[1]).toMatch(
      /❌ BACKUP_DESTINATION_PATH\s+not set \(required\)/,
    );
  });
});
