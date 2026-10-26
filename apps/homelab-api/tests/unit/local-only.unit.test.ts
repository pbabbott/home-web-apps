import {
  RemoteDatabaseTargetError,
  assertDatabaseIsLocal,
} from '../../src/scripts/local-only';

describe('assertDatabaseIsLocal', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '::1', ' localhost '])(
    'allows %s',
    (host) => {
      expect(() => assertDatabaseIsLocal({ host })).not.toThrow();
    },
  );

  it.each([
    'homelab-api-postgres.local.abbottland.io',
    '192.168.4.50',
    'postgres',
    'localhost.evil.example',
    '',
  ])('rejects %s with RemoteDatabaseTargetError', (host) => {
    expect(() => assertDatabaseIsLocal({ host })).toThrow(
      RemoteDatabaseTargetError,
    );
  });
});
