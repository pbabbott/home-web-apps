import { neutral } from '../../tokens/colors';
import { Typography } from '../Typography/Typography';

export type EditableEdgeColor = 'primary' | 'secondary' | 'default';

interface EdgeColorClasses {
  textarea: string;
  editingWrapper: string;
  label: string;
  labelHover: string;
  placeholder: string;
  placeholderHover: string;
  bgStyle?: { backgroundColor: string };
}

function getEdgeColorClasses(color: EditableEdgeColor): EdgeColorClasses {
  switch (color) {
    case 'primary':
      return {
        textarea: 'bg-primary-900 border-primary-500',
        editingWrapper: 'bg-primary-900 border-primary-500',
        label: 'bg-primary-800',
        labelHover: 'hover:bg-primary-700',
        placeholder: 'bg-primary-800/50',
        placeholderHover: 'hover:bg-primary-800',
      };
    case 'secondary':
      return {
        textarea: 'bg-secondary-900 border-secondary-500',
        editingWrapper: 'bg-secondary-900 border-secondary-500',
        label: 'bg-secondary-800',
        labelHover: 'hover:bg-secondary-700',
        placeholder: 'bg-secondary-800/50',
        placeholderHover: 'hover:bg-secondary-800',
      };
    case 'default':
      return {
        textarea: 'bg-neutral-800 border-neutral-600',
        editingWrapper: 'border-neutral-600',
        label: '',
        labelHover: 'hover:bg-neutral-700',
        placeholder: '',
        placeholderHover: 'hover:bg-neutral-700',
        bgStyle: { backgroundColor: neutral[800] },
      };
  }
}

function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = 'auto';
  target.style.height = `${target.scrollHeight}px`;
}

interface EdgeLabelContentProps {
  isEditing: boolean;
  isReadonly: boolean;
  labelValue: string;
  setLabelValue: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onStartEditing: (e: React.MouseEvent) => void;
  onCommit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  color?: EditableEdgeColor;
}

export function EdgeLabelContent({
  isEditing,
  isReadonly,
  labelValue,
  setLabelValue,
  inputRef,
  onStartEditing,
  onCommit,
  onKeyDown,
  color = 'default',
}: EdgeLabelContentProps) {
  const colorClasses = getEdgeColorClasses(color);

  if (isEditing) {
    return (
      <div
        className={`border rounded ${colorClasses.editingWrapper}`}
        style={colorClasses.bgStyle}
      >
        <textarea
          ref={inputRef}
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          onInput={autoResize}
          className={`${colorClasses.textarea} text-white px-2 py-1 outline-none text-sm min-w-[80px] resize-none`}
          placeholder="Enter label..."
          rows={1}
          style={{ minHeight: '2rem', height: 'auto' }}
        />
      </div>
    );
  }

  if (labelValue) {
    return (
      <div
        className={`px-2 ${colorClasses.label} rounded whitespace-pre-line leading-none ${
          isReadonly
            ? 'cursor-default'
            : `cursor-text ${colorClasses.labelHover} transition-colors`
        }`}
        style={colorClasses.bgStyle}
        onClick={onStartEditing}
      >
        <Typography
          variant="caption"
          component="span"
          className="text-neutral-200"
        >
          {labelValue}
        </Typography>
      </div>
    );
  }

  // Ready to edit state
  return (
    <div
      className={`px-2 py-1 ${colorClasses.placeholder} leading-none rounded border border-dashed border-neutral-600 ${
        isReadonly
          ? 'cursor-default'
          : `cursor-text ${colorClasses.placeholderHover} transition-colors`
      }`}
      style={colorClasses.bgStyle}
      onClick={onStartEditing}
    >
      {!isReadonly && (
        <Typography
          variant="caption"
          component="span"
          className="text-neutral-400"
        >
          click to add label
        </Typography>
      )}
    </div>
  );
}
