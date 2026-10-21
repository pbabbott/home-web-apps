import { DiscoveryError } from '@abbottland/homelab-db';
import { assertWithinClaimedDirectory } from '../../src/services/discovery/paths';
import { normalizeWindowsPath } from '../../src/lib/windows-path';

const claimed = normalizeWindowsPath('C:\\Users\\You');
const at = (p: string) => normalizeWindowsPath(p);

describe('assertWithinClaimedDirectory', () => {
  it('accepts paths beneath the claimed directory', () => {
    expect(() =>
      assertWithinClaimedDirectory(claimed, [at('C:\\Users\\You\\Docs')], {
        allowSelf: false,
        subject: 'paths',
      }),
    ).not.toThrow();
  });

  it('accepts the directory itself only when allowSelf', () => {
    const run = (allowSelf: boolean) => () =>
      assertWithinClaimedDirectory(claimed, [at('C:\\Users\\You')], {
        allowSelf,
        subject: 'paths',
      });

    expect(run(true)).not.toThrow();
    expect(run(false)).toThrow(DiscoveryError);
  });

  it('rejects outside and sibling-prefix paths, naming the subject and offenders', () => {
    expect.assertions(3);

    try {
      assertWithinClaimedDirectory(
        claimed,
        [
          at('C:\\Users\\YouOther'),
          at('C:\\Windows'),
          at('C:\\Users\\You\\ok'),
        ],
        { allowSelf: true, subject: 'skipped paths' },
      );
    } catch (err) {
      const e = err as DiscoveryError;
      expect(e.message).toBe(
        'skipped paths are not inside the claimed directory C:\\Users\\You',
      );
      expect(e.code).toBe('conflict');
      expect(e.details).toEqual({
        paths: ['C:\\Users\\YouOther', 'C:\\Windows'],
      });
    }
  });
});
