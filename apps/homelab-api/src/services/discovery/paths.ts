import type {
  InventoryItemType,
  InventoryPath,
  QueuePath,
} from '@abbottland/homelab-db';
import {
  normalizeWindowsPath,
  windowsPathName,
  windowsPathParent,
} from '../../lib/windows-path';

export const toQueuePath = (path: string): QueuePath =>
  normalizeWindowsPath(path);

export type InventoryItemInput = {
  path: string;
  itemType: InventoryItemType;
  sizeBytes?: number;
  modifiedAt?: string;
};

/** Lowercased extension of a file name (`Report.PDF` -> `pdf`); none for dotfiles. */
const fileExtension = (name: string): string | null => {
  const dot = name.lastIndexOf('.');

  return dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1).toLowerCase()
    : null;
};

/** Normalizes a reported path and derives parent, name and extension from it. */
export const toInventoryPath = (input: InventoryItemInput): InventoryPath => {
  const { path, normalizedPath } = normalizeWindowsPath(input.path);
  const parent = windowsPathParent(path);
  const name = windowsPathName(path);

  return {
    itemType: input.itemType,
    path,
    normalizedPath,
    parentPath: parent,
    normalizedParentPath: parent ? parent.toLowerCase() : null,
    name,
    extension: input.itemType === 'file' ? fileExtension(name) : null,
    sizeBytes: input.sizeBytes ?? null,
    modifiedAt: input.modifiedAt ? new Date(input.modifiedAt) : null,
  };
};
