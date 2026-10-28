import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const KEY_ENV = 'EXODUS_CREDENTIAL_KEY';

export class CredentialKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialKeyError';
  }
}

/**
 * Read from the environment at use rather than through `ApplicationConfig`:
 * a config field with no default is required at boot, and the API should
 * still start (and serve everything else) on a deployment that has no key
 * yet. Only the connection and preview routes need it.
 */
const loadKey = (): Buffer => {
  const raw = process.env[KEY_ENV];

  if (!raw) {
    throw new CredentialKeyError(`${KEY_ENV} is not configured`);
  }

  const key = Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new CredentialKeyError(
      `${KEY_ENV} must be 32 bytes, base64 encoded (openssl rand -base64 32)`,
    );
  }

  return key;
};

/** AES-256-GCM. Output is `v1:<iv>:<tag>:<ciphertext>`, each part base64. */
export const encryptSecret = (plaintext: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
    .join(':');
};

/** Throws if the value was tampered with or encrypted under another key. */
export const decryptSecret = (stored: string): string => {
  const [version, iv, tag, ciphertext] = stored.split(':');

  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error('unrecognised secret format');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    loadKey(),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};
