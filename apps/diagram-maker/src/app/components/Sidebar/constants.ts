import type {
  NodeColorScheme,
  HandlePosition,
  HandleType,
} from '@abbottland/fui-components';

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
  { value: 'default', label: 'Default (Neutral)' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
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

export const edgeTypeOptions: { value: string; label: string }[] = [
  { value: 'default', label: 'Basic' },
  { value: 'editable', label: 'Labeled' },
];
