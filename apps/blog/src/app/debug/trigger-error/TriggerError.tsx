'use client';

export default function TriggerError(): never {
  throw new Error('Debug panel: manually triggered error');
}
