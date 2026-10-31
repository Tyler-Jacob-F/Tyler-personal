import { type ReactNode, useState } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/button';

export interface ConfirmDialogProps {
  title: string;
  /** A sentence on what happens; the dialog itself is the question. */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** The confirm is the card's one accented control unless the action is a loss, when it stays outline. */
  tone?: 'accent' | 'quiet';
  pending?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * The one confirmation (docs/DESIGN.md "Frontend conventions" lists it; the claim screen's
 * render drew it): a bordered card on the surface, a question in Literata, a line under
 * it, Back and the answer. Never `window.confirm`.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Back',
  tone = 'accent',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-labelledby="confirm-heading"
      className="rounded-lg border border-border bg-surface px-5 py-5"
    >
      <h2
        id="confirm-heading"
        className="font-serif text-[22px] leading-snug font-medium text-text-strong"
      >
        {title}
      </h2>
      {children && <p className="mt-3 text-[15px] text-muted">{children}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === 'accent' ? 'accent' : 'outline'}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export interface ConfirmButtonProps {
  /** The button at rest. */
  label: string;
  variant?: ButtonVariant;
  className?: string;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm(): void;
}

/** A quiet button that asks once before a loss: delete a document, revoke a token, clear a phone. */
export function ConfirmButton({
  label,
  variant = 'ghost',
  className,
  title,
  children,
  confirmLabel,
  pending = false,
  onConfirm,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className}
        disabled={pending}
        onClick={() => setAsking(true)}
      >
        {label}
      </Button>
    );
  }
  return (
    <ConfirmDialog
      title={title}
      confirmLabel={confirmLabel}
      tone="quiet"
      pending={pending}
      onConfirm={() => {
        setAsking(false);
        onConfirm();
      }}
      onCancel={() => setAsking(false)}
    >
      {children}
    </ConfirmDialog>
  );
}
