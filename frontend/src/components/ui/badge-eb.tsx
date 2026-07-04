import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { Badge as ShadcnBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Employa-Bot design `Badge`. Wraps shadcn `Badge` with a fresh cva that
 * matches the design's `.badge--*` classes: 4px radius, 2px x 8px padding,
 * 12px text, and a 6-variant palette (`default`, `accent`, `warn`,
 * `danger`, `info`, `success`).
 */
const badgeEbVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-[2px] text-xs font-medium whitespace-nowrap [&>svg]:size-3',
  {
    variants: {
      variant: {
        /** Neutral muted fill. */
        default: 'border-border bg-muted text-muted-foreground',
        /** Lime soft fill — match / shortlist. */
        accent: 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-text)]',
        /** Amber soft fill — needs attention. */
        warn: 'border-transparent bg-[var(--warn-soft)] text-[var(--warn-text)]',
        /** Red soft fill — error / blocker. */
        danger: 'border-transparent bg-[var(--danger-soft)] text-[var(--danger-text)]',
        /** Sky soft fill — informational. */
        info: 'border-transparent bg-[var(--info-soft)] text-[var(--info-text)]',
        /** Lime soft fill — positive outcome. */
        success: 'border-transparent bg-[var(--success-soft)] text-[var(--success-text)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeEbProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeEbVariants> {
  /** Use the child as the rendered element (radix Slot pattern). */
  asChild?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeEbProps>(function Badge(
  { className, variant, asChild, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'span';
  return (
    <Comp
      ref={ref}
      data-slot="badge-eb"
      data-variant={variant ?? 'default'}
      className={cn(badgeEbVariants({ variant }), className)}
      {...props}
    />
  );
});

export { Badge, ShadcnBadge };
// eslint-disable-next-line react-refresh/only-export-components
export { badgeEbVariants };
