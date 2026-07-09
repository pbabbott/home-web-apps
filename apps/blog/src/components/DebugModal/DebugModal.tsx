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
  Badge,
  HorizontalRule,
} from '@abbottland/fui-components';
import { Cross1Icon, ReloadIcon } from '@radix-ui/react-icons';
import {
  getAnimationsEnabled,
  getAnimationsOverride,
  setAnimationsDisabledOverride,
  clearAnimationsDisabledOverride,
  subscribeToAnimationsChange,
} from '@/context/Animations.Context';
import {
  getAnalyticsDiagnostics,
  type AnalyticsDiagnostics,
} from '@/lib/analyticsDiagnostics';

export default function DebugModal() {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsDiagnostics | null>(null);

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

  const refreshAnalytics = () => {
    void getAnalyticsDiagnostics().then(setAnalytics);
  };

  useEffect(() => {
    if (open) refreshAnalytics();
  }, [open]);

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

        <HorizontalRule className="mt-4" />

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Typography variant="body2" component="span">
              Umami Analytics
            </Typography>
            <div className="flex items-center gap-2">
              <Badge
                color={
                  analytics?.loaderStatus === 'enabled'
                    ? 'success'
                    : analytics?.loaderStatus === 'disabled'
                      ? 'error'
                      : 'dark'
                }
              >
                {analytics?.loaderStatus ?? 'checking...'}
              </Badge>
              <Button
                onClick={refreshAnalytics}
                color="secondary"
                variant="text"
                className="!p-1 !min-w-0"
                title="Refresh"
                aria-label="Refresh analytics diagnostics"
              >
                <ReloadIcon width={14} height={14} />
              </Button>
            </div>
          </div>
          <Typography
            variant="caption"
            component="p"
            className="text-neutral-400"
          >
            Website ID: {analytics?.websiteId ?? '—'}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            className="text-neutral-400"
          >
            Host: {analytics?.hostUrl ?? '—'}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            className="text-neutral-400"
          >
            Script loaded:{' '}
            {analytics ? (analytics.scriptLoaded ? 'yes' : 'no') : '—'}
          </Typography>
        </div>
      </ModalContent>
    </Modal>
  );
}
