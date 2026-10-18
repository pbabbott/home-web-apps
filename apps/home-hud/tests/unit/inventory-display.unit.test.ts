import {
  formatBytes,
  inventoryUrl,
  isWithinPath,
  pathCrumbs,
  tidyPath,
} from '../../src/app/exodus/lib/inventory-display';

describe('formatBytes', () => {
  it.each([
    [null, '—'],
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [5_000_000_000, '4.7 GB'],
    [3 * 1024 ** 4, '3.0 TB'],
    [5000 * 1024 ** 4, '5000.0 TB'],
  ])('formats %s as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('tidyPath', () => {
  it.each([
    ['C:\\Users\\You', 'C:\\Users\\You'],
    ['C:/Users//You/', 'C:\\Users\\You'],
    ['  C:\\Users\\You\\ ', 'C:\\Users\\You'],
    ['C:\\', 'C:\\'],
    ['\\\\server\\share\\docs\\', '\\\\server\\share\\docs'],
  ])('tidies %s', (input, expected) => {
    expect(tidyPath(input)).toBe(expected);
  });
});

describe('isWithinPath', () => {
  it('matches the folder itself and descendants, ignoring case', () => {
    expect(isWithinPath('C:\\Users\\You', 'c:\\users\\you')).toBe(true);
    expect(isWithinPath('C:\\Users\\You', 'C:\\USERS\\YOU\\Docs\\a')).toBe(
      true,
    );
  });

  it('respects directory boundaries', () => {
    expect(isWithinPath('C:\\Users\\You', 'C:\\Users\\YouOther')).toBe(false);
    expect(isWithinPath('C:\\Users\\You', 'C:\\Users')).toBe(false);
  });

  it('handles a drive root', () => {
    expect(isWithinPath('C:\\', 'C:\\Users')).toBe(true);
    expect(isWithinPath('C:\\', 'D:\\Users')).toBe(false);
  });
});

describe('pathCrumbs', () => {
  it('starts at the root when the path is inside it', () => {
    expect(pathCrumbs('C:\\Users\\You', 'C:\\Users\\You\\Docs\\Tax')).toEqual([
      { label: 'C:\\Users\\You', path: 'C:\\Users\\You' },
      { label: 'Docs', path: 'C:\\Users\\You\\Docs' },
      { label: 'Tax', path: 'C:\\Users\\You\\Docs\\Tax' },
    ]);
  });

  it('is a single crumb at the root itself', () => {
    expect(pathCrumbs('C:\\Users\\You', 'c:/users/you/')).toEqual([
      { label: 'C:\\Users\\You', path: 'C:\\Users\\You' },
    ]);
  });

  it('starts at the drive when the path is outside the root', () => {
    expect(pathCrumbs('C:\\Users\\You', 'C:\\Windows\\System32')).toEqual([
      { label: 'C:\\', path: 'C:\\' },
      { label: 'Windows', path: 'C:\\Windows' },
      { label: 'System32', path: 'C:\\Windows\\System32' },
    ]);
  });

  it('works from a drive root', () => {
    expect(pathCrumbs('D:\\', 'D:\\Photos\\2026')).toEqual([
      { label: 'D:\\', path: 'D:\\' },
      { label: 'Photos', path: 'D:\\Photos' },
      { label: '2026', path: 'D:\\Photos\\2026' },
    ]);
  });

  it('works on a UNC share', () => {
    expect(
      pathCrumbs('\\\\nas\\media', '\\\\nas\\media\\Movies\\2026'),
    ).toEqual([
      { label: '\\\\nas\\media', path: '\\\\nas\\media' },
      { label: 'Movies', path: '\\\\nas\\media\\Movies' },
      { label: '2026', path: '\\\\nas\\media\\Movies\\2026' },
    ]);
  });

  it('falls back to the raw path when it has no drive or share', () => {
    expect(pathCrumbs('C:\\Users', 'relative\\dir')).toEqual([
      { label: 'relative\\dir', path: 'relative\\dir' },
    ]);
  });
});

describe('inventoryUrl', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';
  const base = '/exodus/inventory';

  it('omits defaults', () => {
    expect(inventoryUrl({})).toBe(base);
    expect(inventoryUrl({ recursive: false })).toBe(base);
  });

  it('carries only the source when switching sources', () => {
    expect(inventoryUrl({ source: id })).toBe(`${base}?source=${id}`);
  });

  it('encodes the path and keeps every view option', () => {
    const url = inventoryUrl({
      source: id,
      path: 'C:\\Users\\You\\My Docs',
      recursive: true,
      type: 'file',
      after: 'c:\\users\\you\\a.txt',
    });
    const params = new URL(url, 'http://x').searchParams;

    expect(url.startsWith(`${base}?`)).toBe(true);
    expect(params.get('source')).toBe(id);
    expect(params.get('path')).toBe('C:\\Users\\You\\My Docs');
    expect(params.get('recursive')).toBe('1');
    expect(params.get('type')).toBe('file');
    expect(params.get('after')).toBe('c:\\users\\you\\a.txt');
  });
});
