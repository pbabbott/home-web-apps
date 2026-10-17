/** drizzle wraps driver errors, so the Postgres code can sit on `cause`. */
const hasPgCode = (err: unknown, code: string): boolean => {
  const e = err as { code?: string; cause?: { code?: string } };

  return e?.code === code || e?.cause?.code === code;
};

export const isUniqueViolation = (err: unknown): boolean =>
  hasPgCode(err, '23505');

export const isForeignKeyViolation = (err: unknown): boolean =>
  hasPgCode(err, '23503');
