'use client';

import { Typography, Button } from '@abbottland/fui-components';
import { PlusIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { HandleConfig, HandlePosition, HandleType } from '../nodes/BaseNode';
import { handlePositionOptions, handleTypeOptions } from './constants';

interface HandlesControlProps {
  handles: HandleConfig[];
  onHandlesChange: (handles: HandleConfig[]) => void;
  hasSelection: boolean;
}

export function HandlesControl({
  handles,
  onHandlesChange,
  hasSelection,
}: HandlesControlProps) {
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

  return (
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
  );
}

