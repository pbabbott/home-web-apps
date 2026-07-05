'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button } from '@abbottland/fui-components';
import { CopyIcon } from '@radix-ui/react-icons';

interface ExportTabProps {
  data: { nodes: Node[]; edges: Edge[] };
}

export function ExportTab({ data }: ExportTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = async () => {
    const json = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <>
      <pre className="flex-1 overflow-auto bg-secondary-900 rounded-lg p-4 text-sm text-secondary-300 font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          onClick={handleCopyToClipboard}
          color="primary"
          variant="contained"
          className="flex items-center gap-2"
        >
          <CopyIcon width={16} height={16} />
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </Button>
      </div>
    </>
  );
}
