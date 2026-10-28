import { buildConnectionTarget } from '../../src/connection-target';
import { encryptSecret } from '../../src/secret-box';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('buildConnectionTarget', () => {
  const original = process.env.EXODUS_CREDENTIAL_KEY;

  beforeEach(() => {
    process.env.EXODUS_CREDENTIAL_KEY = KEY;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.EXODUS_CREDENTIAL_KEY;
    else process.env.EXODUS_CREDENTIAL_KEY = original;
  });

  it('maps the host to address and names, and decrypts the password', () => {
    const settings = {
      shareMappings: [{ pathPrefix: 'C:\\Users', share: 'Users' }],
    };

    const target = buildConnectionTarget(
      {
        username: 'me',
        domain: 'HOME',
        secretCiphertext: encryptSecret('hunter2!'),
        settings,
      },
      { ipAddress: '10.0.0.5', name: 'alpha-centauri' },
    );

    expect(target).toEqual({
      address: '10.0.0.5',
      hostNames: ['10.0.0.5', 'alpha-centauri'],
      username: 'me',
      domain: 'HOME',
      password: 'hunter2!',
      settings,
    });
  });
});
