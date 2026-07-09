'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Modal,
  ModalContent,
  ModalTitle,
  ModalDescription,
  Switch,
  Button,
  Typography,
} from '@abbottland/fui-components';
import { Cross1Icon } from '@radix-ui/react-icons';
import {
  getAnimationsEnabled,
  getAnimationsOverride,
  setAnimationsDisabledOverride,
  clearAnimationsDisabledOverride,
  subscribeToAnimationsChange,
} from '@/context/Animations.Context';

export default function DebugModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const animationsEnabled = useSyncExternalStore(
    subscribeToAnimationsChange,
    getAnimationsEnabled,
    () => true,
  );
  const override = useSyncExternalStore(
    subscribeToAnimationsChange,
    getAnimationsOverride,
    () => null,
  );

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalContent color="primary">
        <ModalTitle>Debug Panel</ModalTitle>
        <ModalDescription>Ctrl + ` to toggle this panel.</ModalDescription>

        <div className="mt-4 flex items-center justify-between gap-4">
          <Typography
            variant="body2"
            component="label"
            htmlFor="disable-animations-switch"
          >
            Disable Animations
          </Typography>
          <div className="flex items-center gap-2">
            <Switch
              id="disable-animations-switch"
              checked={!animationsEnabled}
              onCheckedChange={(checked: boolean) =>
                setAnimationsDisabledOverride(checked)
              }
            />
            <Button
              onClick={() => clearAnimationsDisabledOverride()}
              disabled={override === null}
              color="error"
              variant="text"
              className="!p-1 !min-w-0"
              title="Clear override"
              aria-label="Clear override"
            >
              <Cross1Icon width={14} height={14} />
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
