/* eslint-disable @typescript-eslint/no-explicit-any */
import { EnvironmentVariableType } from './decorators';
import {
  appConfigKey,
  configSectionKey,
  environmentVariableKey,
  environmentVariableTypeKey,
} from './constants';

const getNextName = (configSectionPrefix: string, name: string) => {
  const result = configSectionPrefix ? `${configSectionPrefix}_` : '';

  return result + name;
};

const parseEnvironmentVariableValue = (
  envValue: string,
  envType: EnvironmentVariableType,
) => {
  if (envType === EnvironmentVariableType.NUMBER) return Number(envValue);
  if (envType === EnvironmentVariableType.BOOLEAN) return Boolean(envValue);

  return envValue;
};

/**
 * Environment variables matching this pattern are treated as sensitive and
 * their resolved value is redacted when formatted for logging.
 */
const SENSITIVE_ENV_VAR_PATTERN = /PASSWORD|SECRET|TOKEN|_KEY$/i;

export type EnvironmentVariableStatus = {
  /** Dot-delimited path to the property within the config object, e.g. `postgres.password` */
  path: string;
  /** The resolved environment variable name, e.g. `POSTGRES_PASSWORD` */
  envVarName: string;
  /** Whether this variable was actually set in `process.env` */
  isSet: boolean;
  /** True when the field has no default (empty string) and was not set via env */
  isMissing: boolean;
  /** True when the env var name looks like a secret; its value is redacted when formatted */
  isSensitive: boolean;
  /** The resolved value: the parsed environment value if set, otherwise the default */
  value: unknown;
};

/**
 * Walks a config instance decorated with `@EnvironmentVariable`/`@ConfigSection`
 * and reports, for every declared environment variable, whether it was set,
 * what value will be used, and whether it's missing a required value.
 * @param instance A config instance (same shape passed to `loadConfig`)
 * @returns A flat list of the status of every declared environment variable
 */
export const getEnvConfigStatus = (
  instance: any,
  configSectionPrefix = '',
  path = '',
): EnvironmentVariableStatus[] => {
  const keys = Object.keys(instance);
  const results: EnvironmentVariableStatus[] = [];

  const appConfigMetadata = Reflect.getMetadata(
    appConfigKey,
    instance.constructor.prototype,
    'class',
  );
  const prefix = appConfigMetadata ? appConfigMetadata : configSectionPrefix;

  keys.forEach((key) => {
    const nextPath = path ? `${path}.${key}` : key;

    const envMetadata = Reflect.getMetadata(
      environmentVariableKey,
      instance,
      key,
    );

    if (envMetadata) {
      const envVarName = getNextName(prefix, envMetadata);
      const envValue = process.env[envVarName];
      const isSet = envValue !== undefined;
      const envType = Reflect.getMetadata(
        environmentVariableTypeKey,
        instance,
        key,
      ) as EnvironmentVariableType;

      const value = isSet
        ? parseEnvironmentVariableValue(envValue, envType)
        : instance[key];

      results.push({
        path: nextPath,
        envVarName,
        isSet,
        isMissing: !isSet && instance[key] === '',
        isSensitive: SENSITIVE_ENV_VAR_PATTERN.test(envVarName),
        value,
      });
    }

    const configSectionMetadata = Reflect.getMetadata(
      configSectionKey,
      instance,
      key,
    );

    if (configSectionMetadata) {
      const nextPrefix = getNextName(prefix, configSectionMetadata);
      results.push(...getEnvConfigStatus(instance[key], nextPrefix, nextPath));
    }
  });

  return results;
};

const REDACTED_VALUE = '••••••••';

/**
 * Formats the output of {@link getEnvConfigStatus} into clean, aligned,
 * emoji-status log lines suitable for printing at application startup.
 * @example
 * ```
 * ✅ PORT=4002 (env)
 * ⚠️  SHOW_CONFIG=false (default)
 * ❌ POSTGRES_PASSWORD not set (required)
 * ```
 * @param statuses The output of {@link getEnvConfigStatus}
 * @returns One formatted, human-readable line per environment variable
 */
export const formatEnvConfigStatus = (
  statuses: EnvironmentVariableStatus[],
): string[] => {
  const nameWidth = Math.max(...statuses.map((s) => s.envVarName.length));

  return statuses.map((status) => {
    const name = status.envVarName.padEnd(nameWidth);

    if (status.isMissing) {
      return `❌ ${name} not set (required)`;
    }

    const displayValue = status.isSensitive
      ? REDACTED_VALUE
      : String(status.value);
    const source = status.isSet ? 'env' : 'default';
    const icon = status.isSet ? '✅' : '⚠️ ';

    return `${icon} ${name} = ${displayValue} (${source})`;
  });
};
