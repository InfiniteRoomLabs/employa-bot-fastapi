import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { Button as ShadcnButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Employa-Bot design `Button`. Wraps shadcn `Button` to align with the
 * design's larger hit targets (default 36px, lg 44px), solid `danger` fill,
 * and 6px radius. The shadcn primitive at `./button` is untouched per
 * ADR-002 — this sibling re-exports a redesigned shape.
 *
 * Variants map: design `primary -> default` (lime), `secondary`, `ghost`,
 * `danger` (solid red, white text). Sizes: `default 36px`, `sm 28px`,
 * `lg 44px`, `icon 36x36`.
 */
const buttonEbVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-transparent text-sm font-medium whitespace-nowrap outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        /** Lime accent — primary CTA. */
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:translate-y-px',
        /** Neutral fill with a visible border so it reads as a button even
         *  when --secondary is near the surface color (dark mode). */
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:border-[var(--border-strong)] hover:bg-secondary/80 active:translate-y-px',
        /** Transparent — borderless utility action. */
        ghost:
          'bg-transparent text-foreground hover:bg-muted hover:text-foreground active:translate-y-px',
        /** Solid red destructive — overrides shadcn's tint-only `destructive`. */
        danger:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30 active:translate-y-px',
      },
      size: {
        /** 36px tall — design's default. */
        default: 'h-9 px-4 text-sm',
        /** 28px tall — compact toolbar action. */
        sm: 'h-7 px-3 text-xs',
        /** 44px tall — hero CTA. */
        lg: 'h-11 px-5 text-base',
        /** Square 36x36 — icon-only button. */
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonEbProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonEbVariants> {
  /** Use the child as the rendered element (radix Slot pattern). */
  asChild?: boolean;
  /** Optional leading icon node, rendered before children with `gap-2`. */
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonEbProps>(function Button(
  { className, variant, size, asChild, icon, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  // Slot requires a single React child — when asChild is set we pass the
  // caller's child through unchanged. Leading-icon composition only
  // applies when we render our own <button>.
  const content = asChild ? (
    children
  ) : (
    <>
      {icon != null ? <span aria-hidden>{icon}</span> : null}
      {children}
    </>
  );
  return (
    <Comp
      ref={ref}
      data-slot="button-eb"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'default'}
      className={cn(buttonEbVariants({ variant, size }), className)}
      {...props}
    >
      {content}
    </Comp>
  );
});

export { Button, ShadcnButton };
// eslint-disable-next-line react-refresh/only-export-components
export { buttonEbVariants };
