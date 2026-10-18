import {
  createSource as createSourceRow,
  listSources as listSourceRows,
  type CreateSourceInput,
  type Source,
} from '@abbottland/homelab-db';
import { db } from '../../db';

export const createSource = (input: CreateSourceInput): Promise<Source> =>
  createSourceRow(db, input);

export const listSources = (): Promise<Source[]> => listSourceRows(db);
