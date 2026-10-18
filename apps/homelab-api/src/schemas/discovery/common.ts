import { z } from 'zod';
import { normalizeWindowsPath } from '../../lib/windows-path';

const isValidWindowsPath = (value: string): boolean => {
  try {
    normalizeWindowsPath(value);
    return true;
  } catch {
    return false;
  }
};

/** Validates only; services re-run normalizeWindowsPath to get the canonical form. */
export const windowsPathSchema = z
  .string()
  .min(1)
  .refine(isValidWindowsPath, {
    message:
      'must be an absolute Windows path (C:\\folder or \\\\server\\share\\folder) without . or .. segments',
  })
  .meta({ example: 'C:\\Users\\You' });

export const claimTokenSchema = z.uuid().meta({
  description: 'The claimToken returned when the item was claimed.',
});
