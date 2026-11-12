import { parseBoolean } from '../lib/parse-boolean';
import { getEnvConfig } from '../lib/environment';
import { ProjectConfig } from '../fixtures/simple';

describe('parseBoolean', () => {
  it.each(['true', 'TRUE', 'True', '1', 'yes', 'YES', 'on', 'On', ' true '])(
    'parses %j as true',
    (value) => {
      expect(parseBoolean('FOO', value)).toBe(true);
    },
  );

  it.each(['false', 'FALSE', 'False', '0', 'no', 'NO', 'off', 'Off', '', ' '])(
    'parses %j as false',
    (value) => {
      expect(parseBoolean('FOO', value)).toBe(false);
    },
  );

  it.each(['maybe', 'flase', '2', 'enabled'])(
    'throws for %j and names the variable',
    (value) => {
      expect(() => parseBoolean('CLEANUP_DRY_RUN', value)).toThrow(
        /CLEANUP_DRY_RUN/,
      );
    },
  );
});

describe('boolean environment variables via getEnvConfig', () => {
  const ENV_NAME = ['ONE', 'COOL', 'BOOLEAN'].join('_');
  const load = () =>
    getEnvConfig(new ProjectConfig()) as { oneCoolBoolean: boolean };

  afterEach(() => {
    delete process.env[ENV_NAME];
  });

  it('turns "false" into false (was true with Boolean(string))', () => {
    process.env[ENV_NAME] = 'false';
    expect(load().oneCoolBoolean).toBe(false);
  });

  it('turns "true" into true', () => {
    process.env[ENV_NAME] = 'true';
    expect(load().oneCoolBoolean).toBe(true);
  });

  it('throws for an unrecognised value', () => {
    process.env[ENV_NAME] = 'nope';
    expect(() => load()).toThrow(/ONE_COOL_BOOLEAN/);
  });
});
