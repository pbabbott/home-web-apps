const TRUE_VALUES = ['true', '1', 'yes', 'on'];
const FALSE_VALUES = ['false', '0', 'no', 'off', ''];

/**
 * Parses a boolean environment variable value. Case-insensitive `true`, `1`,
 * `yes`, `on` are true; `false`, `0`, `no`, `off` and empty are false. Anything
 * else throws, so a typo never silently picks a value.
 */
export const parseBoolean = (envName: string, envValue: string): boolean => {
  const normalized = envValue.trim().toLowerCase();
  if (TRUE_VALUES.includes(normalized)) return true;
  if (FALSE_VALUES.includes(normalized)) return false;

  throw new Error(
    `Invalid boolean for environment variable ${envName}: "${envValue}". Use one of: true, 1, yes, on, false, 0, no, off.`,
  );
};
