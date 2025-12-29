import type {
  NodeColorScheme,
  HandlePosition,
  HandleType,
} from '../nodes/BaseNode';

export const nodeTypes = [
  {
    type: 'customDefault',
    label: 'Default Node',
    description: 'Simple editable node',
  },
  {
    type: 'labeled',
    label: 'Labeled Node',
    description: 'Node with editable label',
  },
  {
    type: 'text',
    label: 'Text Node',
    description: 'Plain text, no border',
  },
];

export const colorSchemeOptions: { value: NodeColorScheme; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'default', label: 'Default (Neutral)' },
];

export const handlePositionOptions: {
  value: HandlePosition;
  label: string;
}[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export const handleTypeOptions: { value: HandleType; label: string }[] = [
  { value: 'source', label: 'Source (out)' },
  { value: 'target', label: 'Target (in)' },
];
