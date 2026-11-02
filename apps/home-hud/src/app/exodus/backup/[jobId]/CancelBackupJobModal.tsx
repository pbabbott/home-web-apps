import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';

interface Props {
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function CancelBackupJobModal({
  open,
  busy,
  error,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent color="secondary">
        <ModalTitle>Cancel this backup job?</ModalTitle>
        <ModalDescription>
          The worker stops copying for it. Files already verified stay on the
          destination and count as covered; items not yet done stay queued as
          the record. A new job can pick them up.
        </ModalDescription>
        {error && (
          <Typography variant="body2" className="mt-2 text-error-400">
            {error}
          </Typography>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <OutlinedButton
            type="button"
            size="small"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Keep running
          </OutlinedButton>
          <Button
            type="button"
            size="small"
            color="error"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Cancelling…' : 'Cancel job'}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
