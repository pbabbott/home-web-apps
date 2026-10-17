import {
  InvalidWindowsPathError,
  isWithinPath,
  normalizeWindowsPath,
} from '../../src/lib/windows-path';

describe('normalizeWindowsPath', () => {
  it('lowercases the key but keeps original case for display', () => {
    expect(normalizeWindowsPath('C:\\Users\\You\\Documents')).toEqual({
      path: 'C:\\Users\\You\\Documents',
      normalizedPath: 'c:\\users\\you\\documents',
    });
  });

  it('treats different casings as the same normalized path', () => {
    expect(normalizeWindowsPath('c:\\USERS\\you').normalizedPath).toBe(
      normalizeWindowsPath('C:\\Users\\You').normalizedPath,
    );
  });

  it('uppercases the drive letter in the display path', () => {
    expect(normalizeWindowsPath('d:\\data').path).toBe('D:\\data');
  });

  it('converts forward slashes', () => {
    expect(normalizeWindowsPath('C:/Users/You').path).toBe('C:\\Users\\You');
  });

  it('collapses repeated separators', () => {
    expect(normalizeWindowsPath('C:\\\\Users\\\\\\You').path).toBe(
      'C:\\Users\\You',
    );
  });

  it('strips a trailing separator', () => {
    expect(normalizeWindowsPath('C:\\Users\\You\\').path).toBe(
      'C:\\Users\\You',
    );
  });

  it('keeps the trailing separator on a drive root', () => {
    expect(normalizeWindowsPath('C:\\').path).toBe('C:\\');
    expect(normalizeWindowsPath('c:/').normalizedPath).toBe('c:\\');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeWindowsPath('  C:\\Users  ').path).toBe('C:\\Users');
  });

  it('accepts UNC paths and keeps the leading pair', () => {
    expect(normalizeWindowsPath('//Server//Share/Docs/').path).toBe(
      '\\\\Server\\Share\\Docs',
    );
    expect(normalizeWindowsPath('\\\\nas\\share').normalizedPath).toBe(
      '\\\\nas\\share',
    );
  });

  it.each([
    ['empty', ''],
    ['relative', 'Users\\You'],
    ['drive-relative', 'C:Users'],
    ['bare drive', 'C:'],
    ['dot segment', 'C:\\Users\\.\\You'],
    ['dotdot segment', 'C:\\Users\\..\\Windows'],
    ['device namespace', '\\\\?\\C:\\Users'],
    ['UNC without share', '\\\\server'],
    ['illegal character', 'C:\\Users\\Yo*u'],
    ['colon in a segment', 'C:\\Users\\a:b'],
  ])('rejects %s', (_label, input) => {
    expect(() => normalizeWindowsPath(input)).toThrow(InvalidWindowsPathError);
  });
});

describe('isWithinPath', () => {
  it('matches the path itself and descendants', () => {
    expect(isWithinPath('c:\\users\\you', 'c:\\users\\you')).toBe(true);
    expect(isWithinPath('c:\\users\\you', 'c:\\users\\you\\docs\\a')).toBe(
      true,
    );
  });

  it('respects directory boundaries', () => {
    expect(isWithinPath('c:\\users\\you', 'c:\\users\\youother')).toBe(false);
    expect(isWithinPath('c:\\users\\you', 'c:\\users')).toBe(false);
  });

  it('handles a drive root parent', () => {
    expect(isWithinPath('c:\\', 'c:\\users')).toBe(true);
    expect(isWithinPath('c:\\', 'd:\\users')).toBe(false);
  });
});
