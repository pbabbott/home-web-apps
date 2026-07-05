'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { Input, Typography } from '@abbottland/fui-components';
import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useDiagramEditor } from '../DiagramEditorContext';
import { resolveUrl } from '@/lib/url';
import type { LocalDiagram } from './types';

interface LocalDiagramsTabProps {
  onClose: () => void;
}

export function LocalDiagramsTab({ onClose }: LocalDiagramsTabProps) {
  const { onLoadLocalDiagram } = useDiagramEditor();
  const [localDiagrams, setLocalDiagrams] = useState<LocalDiagram[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [localSearch, setLocalSearch] = useState('');

  const toggleCompleted = (filePath: string, current: boolean) => {
    const isComplete = !current;
    setLocalDiagrams((prev) =>
      prev.map((d) => (d.filePath === filePath ? { ...d, isComplete } : d)),
    );
    fetch(resolveUrl('/api/local-diagrams/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, isComplete }),
    }).catch(console.error);
  };

  useEffect(() => {
    fetch(resolveUrl('/api/local-diagrams'))
      .then((r) => r.json())
      .then((d: LocalDiagram[]) => setLocalDiagrams(d))
      .catch(console.error)
      .finally(() => setLoadingLocal(false));
  }, []);

  const filteredLocalDiagrams = localDiagrams.filter((diagram) => {
    const query = localSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      diagram.label.toLowerCase().includes(query) ||
      diagram.blogPost.toLowerCase().includes(query)
    );
  });

  return (
    <>
      {!loadingLocal && localDiagrams.length > 0 && (
        <div className="relative border max-w-[75%] mb-3">
          <MagnifyingGlassIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none z-10"
            width={18}
            height={18}
          />
          <Input
            color="primary"
            placeholder="Search diagrams..."
            value={localSearch}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setLocalSearch(e.target.value)
            }
            className="w-full pl-9"
          />
        </div>
      )}
      {loadingLocal ? (
        <Typography
          variant="body1"
          component="p"
          className="text-secondary-400"
        >
          Loading...
        </Typography>
      ) : localDiagrams.length === 0 ? (
        <Typography
          variant="body1"
          component="p"
          className="text-secondary-400"
        >
          No diagram JSON files found in blog content.
        </Typography>
      ) : filteredLocalDiagrams.length === 0 ? (
        <Typography
          variant="body1"
          component="p"
          className="text-secondary-400"
        >
          No diagrams match &ldquo;{localSearch}&rdquo;.
        </Typography>
      ) : (
        <ul className="flex-1 overflow-auto flex flex-col gap-1 pr-2">
          {filteredLocalDiagrams.map((diagram) => (
            <li key={diagram.filePath} className="flex items-stretch gap-2">
              <button
                onClick={() => {
                  onLoadLocalDiagram(
                    diagram.filePath,
                    diagram.data,
                    diagram.isComplete,
                    diagram.label,
                  );
                  onClose();
                }}
                className={`flex-1 text-left px-4 py-3 rounded-lg border transition-colors ${diagram.isComplete ? 'bg-success-900 hover:bg-success-800 border-success-500 hover:border-success-400' : 'bg-secondary-900 hover:bg-secondary-700 border-secondary-700 hover:border-primary-500'}`}
              >
                <Typography
                  variant="body1"
                  component="span"
                  className={`block ${diagram.isComplete ? 'text-neutral-300' : 'text-secondary-100'}`}
                >
                  {diagram.label}
                </Typography>
                <Typography
                  variant="body2"
                  component="span"
                  className="block text-secondary-400 mt-0.5"
                >
                  {diagram.blogPost}
                </Typography>
              </button>
              <Checkbox.Root
                checked={diagram.isComplete}
                onCheckedChange={() =>
                  toggleCompleted(diagram.filePath, diagram.isComplete)
                }
                title="Mark complete"
                className="flex items-center justify-center w-10 shrink-0 rounded-lg bg-secondary-900 border border-secondary-700 hover:border-success-400 transition-colors cursor-pointer"
              >
                <Checkbox.Indicator>
                  <CheckIcon className="text-success-400 w-4 h-4" />
                </Checkbox.Indicator>
              </Checkbox.Root>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
