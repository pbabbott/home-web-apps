/* eslint-disable turbo/no-undeclared-env-vars */
import 'reflect-metadata';
import { ConfigSection, EnvironmentVariable } from '../lib/decorators';
import {
  formatEnvConfigStatus,
  getEnvConfigStatus,
} from '../lib/config-status';

class PostgresConfig {
  @EnvironmentVariable()
  host: string = 'localhost';

  @EnvironmentVariable()
  database: string = '';

  @EnvironmentVariable()
  password: string = '';
}

class ApplicationConfig {
  @ConfigSection({ sectionPrefix: 'POSTGRES' })
  postgres = new PostgresConfig();
}

describe('getEnvConfigStatus', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_DATABASE;
    delete process.env.POSTGRES_PASSWORD;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('marks a variable as set when present in process.env', () => {
    process.env.POSTGRES_HOST = 'db.internal';

    const statuses = getEnvConfigStatus(new ApplicationConfig());
    const host = statuses.find((s) => s.envVarName === 'POSTGRES_HOST');

    expect(host?.isSet).toBe(true);
    expect(host?.isMissing).toBe(false);
    expect(host?.value).toBe('db.internal');
  });

  it('uses the default and is not missing when a non-empty default exists', () => {
    const statuses = getEnvConfigStatus(new ApplicationConfig());
    const host = statuses.find((s) => s.envVarName === 'POSTGRES_HOST');

    expect(host?.isSet).toBe(false);
    expect(host?.isMissing).toBe(false);
    expect(host?.value).toBe('localhost');
  });

  it('marks a variable as missing when unset and default is an empty string', () => {
    const statuses = getEnvConfigStatus(new ApplicationConfig());
    const database = statuses.find((s) => s.envVarName === 'POSTGRES_DATABASE');

    expect(database?.isSet).toBe(false);
    expect(database?.isMissing).toBe(true);
  });

  it('flags password-like env var names as sensitive', () => {
    const statuses = getEnvConfigStatus(new ApplicationConfig());
    const password = statuses.find((s) => s.envVarName === 'POSTGRES_PASSWORD');
    const host = statuses.find((s) => s.envVarName === 'POSTGRES_HOST');

    expect(password?.isSensitive).toBe(true);
    expect(host?.isSensitive).toBe(false);
  });
});

describe('formatEnvConfigStatus', () => {
  it('redacts sensitive values and marks required-but-missing fields', () => {
    process.env.POSTGRES_PASSWORD = 'super-secret';

    const statuses = getEnvConfigStatus(new ApplicationConfig());
    const lines = formatEnvConfigStatus(statuses);

    const passwordLine = lines.find((l) => l.includes('POSTGRES_PASSWORD'));
    const databaseLine = lines.find((l) => l.includes('POSTGRES_DATABASE'));

    expect(passwordLine).not.toContain('super-secret');
    expect(passwordLine).toContain('••••••••');
    expect(databaseLine).toContain('not set (required)');

    delete process.env.POSTGRES_PASSWORD;
  });
});
