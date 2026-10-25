import {
  describeSmbError,
  parseSmbListing,
  resolveShare,
  smbclientInvocation,
} from '../../src/lib/connections/smb';

describe('resolveShare', () => {
  it('uses the administrative share for a drive path by default', () => {
    expect(resolveShare('C:\\Users\\you\\a.jpg')).toEqual({
      share: 'C$',
      relativePath: 'Users\\you\\a.jpg',
    });
  });

  it('prefers a mapping and strips its prefix', () => {
    expect(
      resolveShare('c:/users/you/a.jpg', [
        { pathPrefix: 'C:\\Users', share: 'Users' },
      ]),
    ).toEqual({ share: 'Users', relativePath: 'you\\a.jpg' });
  });

  it('picks the longest matching prefix', () => {
    const mappings = [
      { pathPrefix: 'C:\\', share: 'C' },
      { pathPrefix: 'C:\\Users', share: 'Users' },
    ];

    expect(resolveShare('C:\\Users\\a.txt', mappings)?.share).toBe('Users');
    expect(resolveShare('C:\\backup-test\\a.txt', mappings)).toEqual({
      share: 'C',
      relativePath: 'backup-test\\a.txt',
    });
  });

  it('does not match a prefix inside a longer folder name', () => {
    expect(
      resolveShare('C:\\UsersOther\\a.txt', [
        { pathPrefix: 'C:\\Users', share: 'Users' },
      ])?.share,
    ).toBe('C$');
  });

  it('maps a drive root mapping', () => {
    expect(
      resolveShare('M:\\asustor\\a.txt', [{ pathPrefix: 'M:\\', share: 'M' }]),
    ).toEqual({ share: 'M', relativePath: 'asustor\\a.txt' });
  });

  it('accepts a UNC path only for this machine', () => {
    const names = ['192.168.4.159', 'alpha-centauri'];

    expect(resolveShare('\\\\ALPHA-CENTAURI\\Users\\a.txt', [], names)).toEqual(
      { share: 'Users', relativePath: 'a.txt' },
    );
    expect(resolveShare('\\\\other\\Users\\a.txt', [], names)).toBeNull();
  });
});

describe('smbclientInvocation', () => {
  const target = {
    address: '10.0.0.5',
    hostNames: [],
    username: 'pabbott',
    domain: null,
    password: 's3cret!',
    settings: {},
  };

  it('passes the password by environment, never argv', () => {
    const { args, env } = smbclientInvocation(target, ['//10.0.0.5/C$']);

    expect(args.join(' ')).not.toContain('s3cret');
    expect(env.PASSWD).toBe('s3cret!');
    expect(args).toEqual(
      expect.arrayContaining(['-U', 'pabbott', '-m', 'SMB3']),
    );
  });

  it('qualifies the username with a domain', () => {
    const { args } = smbclientInvocation({ ...target, domain: 'HOME' }, []);

    expect(args).toContain('HOME\\pabbott');
  });

  it('does not leak the API’s other secrets to the child', () => {
    process.env.POSTGRES_PASSWORD = 'db-secret';

    expect(Object.keys(smbclientInvocation(target, []).env).sort()).toEqual([
      'HOME',
      'PASSWD',
      'PATH',
    ]);
    delete process.env.POSTGRES_PASSWORD;
  });
});

describe('describeSmbError', () => {
  it.each([
    ['tree connect failed: NT_STATUS_ACCESS_DENIED', 'Access denied'],
    ['session setup failed: NT_STATUS_LOGON_FAILURE', 'wrong username'],
    ['NT_STATUS_BAD_NETWORK_NAME', 'share does not exist'],
    ['NT_STATUS_OBJECT_PATH_NOT_FOUND getting alt name', 'File not found'],
  ])('%s', (output, expected) => {
    expect(describeSmbError(output)).toContain(expected);
  });
});

describe('parseSmbListing', () => {
  it('parses files and folders, keeping spaces in names', () => {
    const output = [
      '  .                                   D        0  Tue Mar  4 10:11:12 2025',
      '  ..                                  D        0  Tue Mar  4 10:11:12 2025',
      '  setup (1).exe                       A  1048576  Wed Jan 15 09:05:00 2025',
      '  Old Stuff                           D        0  Sat Dec 21 23:59:59 2024',
      '',
      '\t\t12345 blocks of size 4096. 100 blocks available',
    ].join('\n');

    expect(parseSmbListing(output)).toEqual([
      {
        name: 'setup (1).exe',
        isDirectory: false,
        size: 1048576,
        modifiedAt: '2025-01-15T09:05:00',
      },
      {
        name: 'Old Stuff',
        isDirectory: true,
        size: 0,
        modifiedAt: '2024-12-21T23:59:59',
      },
    ]);
  });

  it('returns nothing for an error', () => {
    expect(
      parseSmbListing('tree connect failed: NT_STATUS_BAD_NETWORK_NAME'),
    ).toEqual([]);
  });
});
