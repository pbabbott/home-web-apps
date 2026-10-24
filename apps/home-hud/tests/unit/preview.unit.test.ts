import { previewKind, previewUrl } from '../../src/app/exodus/lib/preview';

describe('previewKind', () => {
  it.each([
    ['C:\\Users\\you\\Photo.JPG', 'image'],
    ['C:\\a\\b.gif', 'image'],
    ['C:\\a\\doc.pdf', 'pdf'],
    ['C:\\a\\Appointments (1).xml', 'text'],
    ['C:\\a\\notes.txt', 'text'],
  ])('%s is %s', (path, kind) => {
    expect(previewKind(path)).toBe(kind);
  });

  it.each([
    'C:\\a\\logo.svg',
    'C:\\a\\setup.exe',
    'C:\\a\\archive.zip',
    'C:\\a\\.gitignore',
    'C:\\folder.with.dots\\noextension',
    'C:\\Users',
  ])('offers no preview for %s', (path) => {
    expect(previewKind(path)).toBeNull();
  });
});

describe('previewUrl', () => {
  it('encodes the path as a query parameter', () => {
    const url = new URL(previewUrl('abc', 'C:\\a b\\x&y.jpg'), 'http://h');

    expect(url.pathname).toBe('/exodus/preview');
    expect(url.searchParams.get('sourceId')).toBe('abc');
    expect(url.searchParams.get('path')).toBe('C:\\a b\\x&y.jpg');
  });
});
