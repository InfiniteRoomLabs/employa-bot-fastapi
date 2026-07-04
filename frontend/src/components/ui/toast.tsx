import * as React from 'react';
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  InfoIcon,
  PartyPopperIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';
import { toast as sonnerToast, Toaster as SonnerToaster, type ToasterProps } from 'sonner';

import { cn } from '@/lib/utils';

/** Variant tokens recognised by the Employa-Bot `toast.*` helpers. */
export type ToastVariant = 'success' | 'agent' | 'warn' | 'error' | 'celebrate' | 'default';

export interface ToastInput {
  /** Headline shown bold at the top of the row. */
  title: React.ReactNode;
  /** Optional secondary line below the title. */
  sub?: React.ReactNode;
  /** Optional CTA button on the right of the row. */
  cta?: { label: string; onClick?: () => void };
  /** Optional "Undo" affordance — overrides `cta` if both are provided. */
  undo?: { label?: string; onUndo: () => void };
  /** Auto-dismiss timer in ms. Default is 5000 (8000 for `agent`). */
  time?: number;
  /** When true, the toast does not auto-dismiss (manual close only). */
  persist?: boolean;
}

const variantClasses: Record<ToastVariant, string> = {
  success: 'bg-[var(--slate-900)] text-[var(--canvas-50)]',
  agent: 'bg-card text-foreground border border-border',
  warn: 'bg-[var(--warn-soft)] text-[var(--warn-text)] border border-[var(--amber-400)]',
  error: 'bg-[var(--danger-soft)] text-[var(--danger-text)] border border-[var(--danger)]',
  celebrate: 'bg-[var(--accent)] text-[var(--fg-on-accent)] border border-[var(--lime-500)]',
  default: 'bg-card text-foreground border border-border',
};

const variantIcon: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2Icon,
  agent: BotIcon,
  warn: AlertTriangleIcon,
  error: XCircleIcon,
  celebrate: PartyPopperIcon,
  default: InfoIcon,
};

interface ToastBodyProps extends ToastInput {
  variant: ToastVariant;
  toastId: string | number;
}

function ToastBody({ variant, toastId, title, sub, cta, undo, persist }: ToastBodyProps) {
  const Icon = variantIcon[variant];
  const dismiss = () => sonnerToast.dismiss(toastId);
  return (
    <div
      data-slot="toast"
      data-variant={variant}
      className={cn(
        'flex w-[420px] max-w-[520px] items-start gap-3 rounded-[var(--radius-lg)] p-3 shadow-md',
        variantClasses[variant],
      )}
    >
      <div
        data-slot="toast-icon"
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
          variant === 'success' ? 'bg-white/10' : 'border border-border bg-card text-foreground',
        )}
      >
        <Icon className="size-3.5" />
      </div>
      {variant === 'agent' ? (
        <span
          data-slot="toast-bot-pill"
          className="mt-px inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] font-medium"
        >
          <span className="size-1.5 rounded-full bg-[var(--lime-500)]" />
          Coach
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div data-slot="toast-title" className="text-sm font-semibold">
          {title}
        </div>
        {sub != null ? (
          <div data-slot="toast-sub" className="mt-0.5 text-xs opacity-80">
            {sub}
          </div>
        ) : null}
      </div>
      {undo != null ? (
        <button
          type="button"
          data-slot="toast-action"
          className="self-center whitespace-nowrap rounded-[var(--radius-md)] border border-current px-2.5 py-1 text-xs font-semibold opacity-85 hover:opacity-100"
          onClick={() => {
            undo.onUndo();
            dismiss();
          }}
        >
          {undo.label ?? 'Undo'}
        </button>
      ) : cta != null ? (
        <button
          type="button"
          data-slot="toast-action"
          className="self-center whitespace-nowrap rounded-[var(--radius-md)] border border-current px-2.5 py-1 text-xs font-semibold opacity-85 hover:opacity-100"
          onClick={() => {
            cta.onClick?.();
            dismiss();
          }}
        >
          {cta.label}
        </button>
      ) : null}
      {persist ? (
        <button
          type="button"
          data-slot="toast-close"
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 cursor-pointer p-1 opacity-60 hover:opacity-100"
          onClick={dismiss}
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function fireToast(variant: ToastVariant, input: ToastInput) {
  const defaultDuration = variant === 'agent' ? 8000 : 5000;
  const duration = input.persist ? Number.POSITIVE_INFINITY : (input.time ?? defaultDuration);
  return sonnerToast.custom((id) => <ToastBody {...input} variant={variant} toastId={id} />, {
    duration,
  });
}

/**
 * Employa-Bot toast helper namespace. Each method returns the toast id
 * (forwarded from sonner) so callers can imperatively dismiss if
 * needed.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const toast = {
  /** Success toast — dark fill, supports `undo`. */
  success: (input: ToastInput) => fireToast('success', input),
  /** Coach / agent toast — bot pill, lighter fill. */
  agent: (input: ToastInput) => fireToast('agent', input),
  /** Warning toast — amber. Defaults to `persist`. */
  warn: (input: ToastInput) => fireToast('warn', { persist: true, ...input }),
  /** Error toast — red. Defaults to `persist`. */
  error: (input: ToastInput) => fireToast('error', { persist: true, ...input }),
  /** Celebration toast — lime. Defaults to `persist`. */
  celebrate: (input: ToastInput) => fireToast('celebrate', { persist: true, ...input }),
  /** Neutral default toast. */
  default: (input: ToastInput) => fireToast('default', input),
  /** Programmatic dismiss — forwards to sonner. */
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

/**
 * Mountable `Toaster` — re-exports sonner's component preconfigured for
 * bottom-center placement (the design's anchor) with our chrome.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-center"
      richColors={false}
      toastOptions={{ classNames: { toast: 'eb-toast' } }}
      {...props}
    />
  );
}
