import { ZodError } from 'zod';

export type ValidationError = {
  field: string;
  message: string;
};

export const formatZodError = (error: ZodError): ValidationError[] =>
  error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
