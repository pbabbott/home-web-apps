import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross1Icon } from '@radix-ui/react-icons';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export type ModalColor = 'primary' | 'secondary';

interface ModalColorTokens {
  border: string;
  close: string;
}

const modalColorTokens: Record<ModalColor, ModalColorTokens> = {
  primary: {
    border: 'border-primary-700',
    close: 'text-primary-500 hover:text-primary-300',
  },
  secondary: {
    border: 'border-secondary-700',
    close: 'text-secondary-500 hover:text-secondary-300',
  },
};

// Entrance-only keyframes (no exit-state rule): Radix's Presence unmounts a
// closed Dialog.Content/Overlay immediately unless it detects a running CSS
// animation for the closed state, so scoping this to data-[state=open] keeps
// close/Escape/outside-click working without extra exit-animation plumbing.
const modalAnimationStyles = `
@keyframes fui-modal-overlay-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fui-modal-content-in {
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
`;

export interface ModalContentProps
  extends React.ComponentProps<typeof Dialog.Content> {
  color?: ModalColor;
}

export const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  function ModalContent(
    { color = 'primary', className, children, ...props },
    ref,
  ) {
    const tokens = modalColorTokens[color];
    return (
      <Dialog.Portal>
        <style>{modalAnimationStyles}</style>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-1000/80 backdrop-blur-sm data-[state=open]:[animation:fui-modal-overlay-in_200ms_ease-out]" />
        <Dialog.Content
          ref={ref}
          className={extendedTwMerge(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'bg-neutral-1000 border px-6 py-5 outline-none',
            'data-[state=open]:[animation:fui-modal-content-in_200ms_ease-out]',
            tokens.border,
            className,
          )}
          {...props}
        >
          <Dialog.Close
            className={extendedTwMerge(
              'absolute right-3 top-3 cursor-pointer outline-none transition-colors',
              tokens.close,
            )}
            aria-label="Close"
          >
            <Cross1Icon />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    );
  },
);

export type ModalTitleProps = Omit<
  React.ComponentProps<typeof Typography>,
  'component' | 'variant'
> & { variant?: React.ComponentProps<typeof Typography>['variant'] };

export const ModalTitle: React.FC<ModalTitleProps> = ({
  variant = 'h4',
  className,
  ...props
}) => (
  <Dialog.Title asChild>
    <Typography
      variant={variant}
      component="h2"
      className={extendedTwMerge('pr-6', className)}
      {...props}
    />
  </Dialog.Title>
);

export type ModalDescriptionProps = Omit<
  React.ComponentProps<typeof Typography>,
  'component' | 'variant'
> & { variant?: React.ComponentProps<typeof Typography>['variant'] };

export const ModalDescription: React.FC<ModalDescriptionProps> = ({
  variant = 'body2',
  className,
  ...props
}) => (
  <Dialog.Description asChild>
    <Typography
      variant={variant}
      component="p"
      className={extendedTwMerge('mt-2 text-neutral-300', className)}
      {...props}
    />
  </Dialog.Description>
);
