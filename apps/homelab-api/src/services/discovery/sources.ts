import {
  createSource as createSourceRow,
  listSources as listSourceRows,
  updateSource as updateSourceRow,
  type CreateSourceInput,
  type UpdateSourceInput,
  type Source,
} from '@abbottland/homelab-db';
import { db } from '../../db';

export const createSource = (input: CreateSourceInput): Promise<Source> =>
  createSourceRow(db, input);

export const listSources = (): Promise<Source[]> => listSourceRows(db);

export const updateSource = (
  id: string,
  input: UpdateSourceInput,
): Promise<Source> => updateSourceRow(db, id, input);
