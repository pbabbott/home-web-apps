import { previewTypeOf } from '../../src/lib/preview-types';
import { decodeText } from '../../src/services/discovery/source-connections';

describe('previewTypeOf', () => {
  it.each([
    ['C:\\a\\Photo.JPG', 'image'],
    ['C:\\a\\x.gif', 'image'],
    ['C:\\a\\doc.pdf', 'pdf'],
    ['C:\\a\\Appointments (1).xml', 'text'],
    ['C:\\a\\notes.txt', 'text'],
    ['C:\\a\\Archive.ZIP', 'zip'],
  ])('%s is %s', (path, kind) => {
    expect(previewTypeOf(path)?.kind).toBe(kind);
  });

  it.each([
    'C:\\a\\logo.svg',
    'C:\\a\\setup.exe',
    'C:\\a\\archive.rar',
    'C:\\a\\.gitignore',
    'C:\\a.b\\noextension',
  ])('refuses %s', (path) => {
    expect(previewTypeOf(path)).toBeNull();
  });

  it('serves text as plain text so markup is never interpreted', () => {
    expect(previewTypeOf('C:\\a\\x.xml')?.contentType).toBe(
      'text/plain; charset=utf-8',
    );
  });
});

describe('decodeText', () => {
  it('passes UTF-8 through and drops a BOM', () => {
    expect(decodeText(Buffer.from('\uFEFFhello', 'utf8')).toString()).toBe(
      'hello',
    );
  });

  it('decodes UTF-16LE with a BOM', () => {
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('<a>é</a>', 'utf16le'),
    ]);

    expect(decodeText(bytes).toString()).toBe('<a>é</a>');
  });

  it('decodes UTF-16BE with a BOM', () => {
    const bytes = Buffer.concat([
      Buffer.from([0xfe, 0xff]),
      Buffer.from('hi', 'utf16le').swap16(),
    ]);

    expect(decodeText(bytes).toString()).toBe('hi');
  });
});
