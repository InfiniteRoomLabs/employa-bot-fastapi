import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Employa-Bot filter `Chip`. Pressable toggle (radix `Toggle`) matching the
 * design's `.chip / .chip--accent / .chip--dash / .chip--exclude` rules.
 * `count` renders a trailing mono numeral with reduced opacity (more
 * opaque when pressed).
 */
const chipVariants = cva(
  'inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        /** Neutral filter chip. Pressed inverts to fg/bg pair. */
        default:
          'border-border bg-card text-muted-foreground hover:border-[var(--border-strong)] hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background',
        /** Lime fill when pressed. */
        accent:
          'border-border bg-card text-muted-foreground hover:border-[var(--border-strong)] hover:text-foreground aria-pressed:border-transparent aria-pressed:bg-[var(--accent)] aria-pressed:text-[var(--fg-on-accent)]',
        /** Dashed border — placeholder / add-new affordance. */
        dash: 'border-dashed border-border bg-card text-muted-foreground hover:border-[var(--border-strong)] hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background',
        /** Red soft fill — exclusion / negation filter. */
        exclude:
          'border-transparent bg-[var(--danger-soft)] text-[var(--danger-text)] hover:opacity-90',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface ChipProps
  extends
    Omit<React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>, 'asChild'>,
    VariantProps<typeof chipVariants> {
  /** Optional trailing mono count badge. */
  count?: number;
}

const Chip = React.forwardRef<React.ComponentRef<typeof TogglePrimitive.Root>, ChipProps>(
  function Chip({ className, variant, count, children, ...props }, ref) {
    return (
      <TogglePrimitive.Root
        ref={ref}
        data-slot="chip"
        data-variant={variant ?? 'default'}
        className={cn(chipVariants({ variant }), className)}
        {...props}
      >
        {children}
        {count != null ? (
          <span
            data-slot="chip-count"
            className="font-mono text-[10px] opacity-60 in-aria-pressed:opacity-85"
          >
            {count}
          </span>
        ) : null}
      </TogglePrimitive.Root>
    );
  },
);

export { Chip };
// eslint-disable-next-line react-refresh/only-export-components
export { chipVariants };
