'use client';

import { useState } from 'react';
import { Typography } from '@abbottland/fui-components';
import {
  Icon,
  useIconSearch,
  type FuiIconDefinition,
  type IconSource,
} from '@abbottland/fui-icons';
import { useDiagramEditor } from '../../DiagramEditorContext';

const TABS: { label: string; source: IconSource }[] = [
  { label: 'Brands', source: 'simple' },
  { label: 'Custom', source: 'custom' },
  { label: 'Radix', source: 'radix' },
];

export function IconControl() {
  const { selectedNodeIds, selectedIconId, onIconChange } = useDiagramEditor();
  const hasSelection = selectedNodeIds.length > 0;
  const [query, setQuery] = useState('');
  const [activeSource, setActiveSource] = useState<IconSource>('simple');
  const results = useIconSearch(query, activeSource);

  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Icon
      </Typography>
      <div
        className={`transition-opacity ${hasSelection ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}
      >
        <div className="flex gap-1 mb-2">
          {TABS.map((tab) => (
            <button
              key={tab.source}
              onClick={() => setActiveSource(tab.source)}
              className={`flex-1 px-2 py-1 rounded text-caption border transition-colors ${
                activeSource === tab.source
                  ? 'bg-primary-700 border-primary-400 text-primary-100'
                  : 'bg-neutral-800 border-primary-700 text-primary-400 hover:bg-primary-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search icons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!hasSelection}
          className="w-full bg-primary-900 border border-primary-600 text-primary-200 rounded px-3 py-2 text-caption !leading-normal outline-none focus:border-primary-500 disabled:cursor-not-allowed mb-2"
        />
        <div className="grid grid-cols-5 gap-1 max-h-40 overflow-y-auto">
          {results.map((def: FuiIconDefinition) => (
            <button
              key={def.id}
              onClick={() =>
                onIconChange(selectedIconId === def.id ? undefined : def.id)
              }
              title={def.label}
              className={`
                flex items-center justify-center p-2 rounded border text-xs
                ${
                  selectedIconId === def.id
                    ? 'bg-primary-700 border-primary-400 text-primary-100'
                    : 'bg-neutral-800 border-primary-700 text-primary-300 hover:bg-primary-800'
                }
              `}
            >
              <Icon name={def.id} size={18} colored={true} />
            </button>
          ))}
        </div>
        {selectedIconId && (
          <button
            onClick={() => onIconChange(undefined)}
            className="mt-1 text-caption text-neutral-400 hover:text-neutral-200 underline"
          >
            Clear icon
          </button>
        )}
      </div>
    </div>
  );
}
