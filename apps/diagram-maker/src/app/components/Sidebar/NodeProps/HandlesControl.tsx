'use client';

import {
  Typography,
  Button,
  type HandleConfig,
  type HandlePosition,
} from '@abbottland/fui-components';
import { PlusIcon, Cross2Icon } from '@radix-ui/react-icons';
import * as Switch from '@radix-ui/react-switch';
import { useDiagramEditor } from '../../DiagramEditorContext';
import { handlePositionOptions } from '../constants';

export function HandlesControl() {
  const { selectedNodeIds, selectedHandles, onHandlesChange } =
    useDiagramEditor();
  const hasSelection = selectedNodeIds.length > 0;
  const handles = selectedHandles;
  const canAddHandle = handles.length < 4;

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
        <Typography variant="body1" component="p" className="text-primary-300">
          Handles ({handles.length}/4)
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
              className="bg-neutral-900 rounded p-2 border border-primary-600"
            >
              <div className="flex items-center justify-between mb-2">
                <Typography
                  variant="caption"
                  component="span"
                  className="text-primary-400"
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
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2 flex-1">
                  <Typography
                    variant="caption"
                    component="label"
                    htmlFor={`handle-type-${handle.id}`}
                    className="text-primary-300 whitespace-nowrap"
                  >
                    {handle.type === 'source' ? 'Out' : 'In'}
                  </Typography>
                  <Switch.Root
                    id={`handle-type-${handle.id}`}
                    checked={handle.type === 'source'}
                    onCheckedChange={(checked) =>
                      updateHandle(handle.id, {
                        type: checked ? 'source' : 'target',
                      })
                    }
                    disabled={!hasSelection}
                    className="w-9 h-5 bg-primary-900 rounded-full relative data-[state=checked]:bg-primary-500 outline-none cursor-default disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[18px]" />
                  </Switch.Root>
                </div>
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
