'use client';

import { useState } from 'react';
import { Typography, Button } from '@abbottland/fui-components';
import { QuestionMarkCircledIcon, Cross2Icon } from '@radix-ui/react-icons';

export function TipsSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="text"
        color="secondary"
        className="text-secondary-400 hover:text-white p-2"
        title="Tips"
      >
        <QuestionMarkCircledIcon width={20} height={20} />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <Typography variant="h3" component="h3">
                Tips
              </Typography>
              <Button
                onClick={() => setIsOpen(false)}
                color="secondary"
                variant="text"
                className="text-secondary-400 hover:text-white"
              >
                <Cross2Icon width={20} height={20} />
              </Button>
            </div>

            <ul className="list-disc list-inside space-y-2 text-secondary-300">
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
        </div>
      )}
    </>
  );
}
