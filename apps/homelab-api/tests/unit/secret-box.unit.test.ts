import { decryptSecret, encryptSecret } from '../../src/lib/secret-box';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('secret-box', () => {
  const original = process.env.EXODUS_CREDENTIAL_KEY;

  beforeEach(() => {
    process.env.EXODUS_CREDENTIAL_KEY = KEY;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.EXODUS_CREDENTIAL_KEY;
    else process.env.EXODUS_CREDENTIAL_KEY = original;
  });

  it('round-trips and does not store the plaintext', () => {
    const stored = encryptSecret('hunter2!');

    expect(stored.startsWith('v1:')).toBe(true);
    expect(stored).not.toContain('hunter2');
    expect(decryptSecret(stored)).toBe('hunter2!');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects a tampered value', () => {
    const [version, iv, tag, ciphertext] = encryptSecret('hunter2!').split(':');
    const flipped = Buffer.from(ciphertext, 'base64');
    flipped[0] ^= 1;

    expect(() =>
      decryptSecret([version, iv, tag, flipped.toString('base64')].join(':')),
    ).toThrow();
  });

  it('rejects a value encrypted under another key', () => {
    const stored = encryptSecret('hunter2!');
    process.env.EXODUS_CREDENTIAL_KEY = Buffer.alloc(32, 9).toString('base64');

    expect(() => decryptSecret(stored)).toThrow();
  });

  it('refuses to run without a usable key', () => {
    delete process.env.EXODUS_CREDENTIAL_KEY;
    expect(() => encryptSecret('x')).toThrow('not configured');

    process.env.EXODUS_CREDENTIAL_KEY = Buffer.alloc(8).toString('base64');
    expect(() => encryptSecret('x')).toThrow('32 bytes');
  });
});
