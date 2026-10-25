/**
 * Whether an entry name matches a skipped-group pattern: `*` is any run of
 * characters, `?` one character, everything else literal, case-insensitive
 * (Windows names). Patterns are single-level, so there is no path handling.
 */
export const matchesNamePattern = (pattern: string, name: string): boolean => {
  const source = pattern
    .split('')
    .map((char) => {
      if (char === '*') return '.*';
      if (char === '?') return '.';

      return char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('');

  return new RegExp(`^${source}$`, 'is').test(name);
};
