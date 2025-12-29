'use client';

import { Card, Typography, Button } from '@abbottland/fui-components';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';
import { DragEvent } from 'react';
import type {
  NodeColorScheme,
  HandleConfig,
  HandlePosition,
  HandleType,
} from './nodes/BaseNode';

const nodeTypes = [
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

const colorSchemeOptions: { value: NodeColorScheme; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'default', label: 'Default (Neutral)' },
];

const handlePositionOptions: { value: HandlePosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const handleTypeOptions: { value: HandleType; label: string }[] = [
  { value: 'source', label: 'Source (out)' },
  { value: 'target', label: 'Target (in)' },
];

interface SidebarProps {
  selectedNodeIds: string[];
  onSendToFront: () => void;
  onSendToBack: () => void;
  selectedColorScheme?: NodeColorScheme;
  onColorSchemeChange: (colorScheme: NodeColorScheme) => void;
  selectedHandles?: HandleConfig[];
  onHandlesChange: (handles: HandleConfig[]) => void;
}

export function Sidebar({
  selectedNodeIds,
  onSendToFront,
  onSendToBack,
  selectedColorScheme,
  onColorSchemeChange,
  selectedHandles,
  onHandlesChange,
}: SidebarProps) {
  const hasSelection = selectedNodeIds.length > 0;
  const handles = selectedHandles ?? [];
  const canAddHandle = handles.length < 2;

  const addHandle = () => {
    if (!canAddHandle) return;
    const newHandle: HandleConfig = {
      id: `handle-${Date.now()}`,
      type: 'source',
      position: 'bottom',
    };
    onHandlesChange([...handles, newHandle]);
  };

  const removeHandle = (handleId: string) => {
    onHandlesChange(handles.filter((h) => h.id !== handleId));
  };

  const updateHandle = (
    handleId: string,
    updates: Partial<Pick<HandleConfig, 'type' | 'position'>>,
  ) => {
    onHandlesChange(
      handles.map((h) => (h.id === handleId ? { ...h, ...updates } : h)),
    );
  };

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-neutral-800 border-r border-neutral-300 p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Nodes Section */}
      <div>
        <Typography variant="h2" component="h2">
          Nodes
        </Typography>
        <Typography variant="body1" component="p" className="text-neutral-50">
          Drag nodes onto the canvas
        </Typography>
      </div>

      <div className="flex flex-col gap-2">
        {nodeTypes.map(({ type, label, description }) => (
          <Card key={type} color="primary">
            <div
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              className="cursor-grab transition-colors active:cursor-grabbing"
            >
              <Typography variant="h5" component="h5">
                {label}
              </Typography>
              <Typography variant="body1" component="div">
                {description}
              </Typography>
            </div>
          </Card>
        ))}
      </div>

      {/* Selection Section */}
      <div className="border-t border-secondary-700 pt-4">
        <Typography variant="h2" component="h2">
          Props
        </Typography>
        {hasSelection ? (
          <Typography
            variant="body1"
            component="p"
            className="text-neutral-100"
          >
            {selectedNodeIds.length} node{selectedNodeIds.length > 1 ? 's' : ''}{' '}
            selected
          </Typography>
        ) : (
          <Typography
            variant="body1"
            component="p"
            className="text-neutral-500 italic"
          >
            No selection
          </Typography>
        )}
      </div>

      {/* Color Scheme Control */}
      <div>
        <Typography
          variant="body1"
          component="p"
          className="text-primary-300 mb-2"
        >
          Color Scheme
        </Typography>
        <select
          value={selectedColorScheme ?? 'default'}
          onChange={(e) =>
            onColorSchemeChange(e.target.value as NodeColorScheme)
          }
          disabled={!hasSelection}
          className="w-full bg-primary-900 border border-primary-600 text-primary-200 rounded px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {colorSchemeOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Handles Control */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Typography
            variant="body1"
            component="p"
            className="text-primary-300"
          >
            Handles ({handles.length}/2)
          </Typography>
          <Button
            onClick={addHandle}
            disabled={!hasSelection || !canAddHandle}
            color="primary"
            variant="text"
            className="!p-1 !min-w-0"
            title="Add handle"
          >
            <PlusIcon width={16} height={16} />
          </Button>
        </div>

        {handles.length === 0 ? (
          <Typography
            variant="body1"
            component="p"
            className="text-neutral-500 italic"
          >
            No handles
          </Typography>
        ) : (
          <div className="flex flex-col gap-2">
            {handles.map((handle, index) => (
              <div
                key={handle.id}
                className="bg-primary-900 rounded p-2 border border-primary-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <Typography
                    variant="body1"
                    component="span"
                    className="text-primary-400 text-xs"
                  >
                    Handle {index + 1}
                  </Typography>
                  <button
                    onClick={() => removeHandle(handle.id)}
                    disabled={!hasSelection}
                    className="text-primary-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove handle"
                  >
                    <Cross2Icon width={14} height={14} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={handle.type}
                    onChange={(e) =>
                      updateHandle(handle.id, {
                        type: e.target.value as HandleType,
                      })
                    }
                    disabled={!hasSelection}
                    className="flex-1 bg-primary-900 border border-primary-600 text-primary-200 rounded px-2 py-1 text-xs outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {handleTypeOptions.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={handle.position}
                    onChange={(e) =>
                      updateHandle(handle.id, {
                        position: e.target.value as HandlePosition,
                      })
                    }
                    disabled={!hasSelection}
                    className="flex-1 bg-primary-900 border border-primary-600 text-primary-200 rounded px-2 py-1 text-xs outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {handlePositionOptions.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layer Controls */}
      <div>
        <Typography
          variant="body1"
          component="p"
          className="text-primary-300 mb-2"
        >
          Layer Order
        </Typography>
        <div className="flex gap-2">
          <Button
            onClick={onSendToFront}
            disabled={!hasSelection}
            color="primary"
            variant="outlined"
            className="flex-1 flex items-center justify-center gap-1.5"
            title="Send to Front (renders on top)"
          >
            <ChevronUpIcon width={16} height={16} />
            Front
          </Button>
          <Button
            onClick={onSendToBack}
            disabled={!hasSelection}
            color="primary"
            variant="outlined"
            className="flex-1 flex items-center justify-center gap-1.5"
            title="Send to Back (renders behind)"
          >
            <ChevronDownIcon width={16} height={16} />
            Back
          </Button>
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-auto border-t border-secondary-700 pt-4 text-xs text-secondary-500">
        <Typography
          variant="body1"
          component="p"
          className="text-secondary-400"
        >
          Tips:
        </Typography>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>
            <Typography variant="body1" component="span">
              Drag from handle to handle to connect
            </Typography>
          </li>
          <li>
            <Typography variant="body1" component="span">
              Click a node to select it
            </Typography>
          </li>
          <li>
            <Typography variant="body1" component="span">
              Drag corners to resize
            </Typography>
          </li>
          <li>
            <Typography variant="body1" component="span">
              Double-click to edit text
            </Typography>
          </li>
          <li>
            <Typography variant="body1" component="span">
              Press Delete to remove selected
            </Typography>
          </li>
        </ul>
      </div>
    </aside>
  );
}
