'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import type { ShareMapping, SourceConnection } from './lib/homelab-api';
import { LocalDateTime } from '../lib/LocalDateTime';

/** The connection part of the source form. `type` none means no connection. */
export interface ConnectionForm {
  type: 'none' | 'smb';
  username: string;
  domain: string;
  /** Empty when editing keeps the stored password. */
  password: string;
  shareMappings: ShareMapping[];
}

export const emptyConnectionForm: ConnectionForm = {
  type: 'none',
  username: '',
  domain: '',
  password: '',
  shareMappings: [],
};

export const connectionFormOf = (
  connection: SourceConnection | null,
): ConnectionForm =>
  connection
    ? {
        type: connection.connectionType,
        username: connection.username,
        domain: connection.domain ?? '',
        password: '',
        shareMappings: connection.settings.shareMappings ?? [],
      }
    : emptyConnectionForm;

const TYPE_LABELS = {
  none: 'No connection',
  smb: 'SMB (Windows file sharing)',
} as const;

interface SourceConnectionFieldsProps {
  form: ConnectionForm;
  onChange: (form: ConnectionForm) => void;
  /** The saved connection, for the stored-password hint and last test result. */
  saved: SourceConnection | null;
  disabled: boolean;
  testing: boolean;
  onTest: () => void;
}

export function SourceConnectionFields({
  form,
  onChange,
  saved,
  disabled,
  testing,
  onTest,
}: SourceConnectionFieldsProps) {
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const set = (patch: Partial<ConnectionForm>) =>
    onChange({ ...form, ...patch });
  const setMapping = (index: number, patch: Partial<ShareMapping>) =>
    set({
      shareMappings: form.shareMappings.map((mapping, i) =>
        i === index ? { ...mapping, ...patch } : mapping,
      ),
    });

  return (
    <fieldset className="flex flex-col gap-3 rounded border border-neutral-700 p-3">
      <legend className="px-1">
        <Typography variant="body2" className="text-neutral-400">
          File access (for previews)
        </Typography>
      </legend>

      <DropdownMenu open={typeMenuOpen} onOpenChange={setTypeMenuOpen}>
        <DropdownMenuTrigger asChild>
          <OutlinedButton type="button" size="small">
            {TYPE_LABELS[form.type]}
          </OutlinedButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent label="Connection type">
          <DropdownMenuItem onSelect={() => set({ type: 'none' })}>
            {TYPE_LABELS.none}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => set({ type: 'smb' })}>
            {TYPE_LABELS.smb}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {form.type === 'smb' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <Typography variant="body2" className="text-neutral-400">
                Username
              </Typography>
              <Input
                required
                autoComplete="off"
                value={form.username}
                onChange={(e) => set({ username: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <Typography variant="body2" className="text-neutral-400">
                Domain (optional)
              </Typography>
              <Input
                autoComplete="off"
                value={form.domain}
                onChange={(e) => set({ domain: e.target.value })}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <Typography variant="body2" className="text-neutral-400">
              Password
            </Typography>
            <Input
              type="password"
              autoComplete="new-password"
              required={!saved}
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              placeholder={saved ? 'Saved. Leave blank to keep it' : ''}
            />
          </label>

          <div className="flex flex-col gap-2">
            <Typography variant="body2" className="text-neutral-400">
              Shares. Windows blocks the default C$ for local accounts, so name
              the share that serves each path. Without a match, C:\ uses C$.
            </Typography>
            {form.shareMappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="min-w-0 flex-1"
                  aria-label="Path prefix"
                  placeholder="C:\Users"
                  value={mapping.pathPrefix}
                  onChange={(e) =>
                    setMapping(index, { pathPrefix: e.target.value })
                  }
                />
                <Typography variant="body2">→</Typography>
                <Input
                  className="min-w-0 flex-1"
                  aria-label="Share name"
                  placeholder="Users"
                  value={mapping.share}
                  onChange={(e) => setMapping(index, { share: e.target.value })}
                />
                <OutlinedButton
                  type="button"
                  size="small"
                  onClick={() =>
                    set({
                      shareMappings: form.shareMappings.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  Remove
                </OutlinedButton>
              </div>
            ))}
            <div>
              <OutlinedButton
                type="button"
                size="small"
                onClick={() =>
                  set({
                    shareMappings: [
                      ...form.shareMappings,
                      { pathPrefix: '', share: '' },
                    ],
                  })
                }
              >
                Add share
              </OutlinedButton>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <OutlinedButton
              type="button"
              size="small"
              disabled={disabled || testing || !form.username}
              onClick={onTest}
            >
              {testing ? 'Testing…' : 'Save and test'}
            </OutlinedButton>
            {saved?.lastTestedAt && (
              <Typography
                variant="body2"
                className={
                  saved.lastTestOk ? 'text-success-400' : 'text-error-400'
                }
              >
                {saved.lastTestOk ? 'Connected' : saved.lastTestError}{' '}
                <span className="text-neutral-400">
                  (<LocalDateTime iso={saved.lastTestedAt} />)
                </span>
              </Typography>
            )}
          </div>
        </>
      )}
    </fieldset>
  );
}
