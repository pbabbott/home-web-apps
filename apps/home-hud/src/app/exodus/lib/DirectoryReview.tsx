'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@abbottland/fui-icons';
import { OutlinedButton, Typography } from '@abbottland/fui-components';

export function Detail({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Typography variant="body1" className="text-neutral-400">
        {title}
      </Typography>
      <Typography variant="body2" className="break-words">
        {children}
      </Typography>
    </div>
  );
}

/** Copies `text`; clipboard access can be denied (insecure origin, no permission), so failure is shown, not thrown. */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <OutlinedButton size="small" color="secondary" onClick={() => void copy()}>
      {state === 'copied'
        ? 'Copied'
        : state === 'failed'
          ? 'Copy failed'
          : 'Copy'}
    </OutlinedButton>
  );
}

/** The button that marks a skip as reviewed, or takes that back. */
export function AcknowledgeControl({
  acknowledged,
  disabled,
  onAcknowledge,
  onUndo,
}: {
  acknowledged: boolean;
  disabled?: boolean;
  onAcknowledge: () => void;
  onUndo: () => void;
}) {
  if (acknowledged) {
    return (
      <OutlinedButton
        size="small"
        color="warning"
        disabled={disabled}
        onClick={onUndo}
      >
        Undo ack
      </OutlinedButton>
    );
  }

  return (
    <OutlinedButton
      size="small"
      color="success"
      disabled={disabled}
      onClick={onAcknowledge}
    >
      Acknowledge
    </OutlinedButton>
  );
}

/** A check when every skip is dealt with (or there are none), a flag when some are not, nothing when unknown. */
export function ReviewedMark({ reviewed }: { reviewed: boolean | null }) {
  if (reviewed === null) return null;

  return reviewed ? (
    <Icon
      name="radix-check"
      size={16}
      className="text-success-400"
      title="All skips reviewed"
    />
  ) : (
    <Icon
      name="radix-warning"
      size={16}
      className="text-warning-400"
      title="Skips still to review"
    />
  );
}
