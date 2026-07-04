import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Employa-Bot design `Card`. Overrides shadcn's `rounded-xl ring-1 py-4 px-4`
 * base with the design's `10px radius`, real border, `24px` padding, and
 * `shadow-sm`. Sibling subcomponents `CardHeader`, `CardTitle`,
 * `CardDescription`, `CardContent`, `CardFooter` are re-exported from
 * shadcn untouched. `CardEbHead` is a new strip subcomponent matching
 * `.eb-card-head`.
 */
const cardEbVariants = cva(
  'flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card text-card-foreground shadow-sm',
  {
    variants: {
      variant: {
        /** Standard 24px padding. */
        default: 'p-6',
        /** Compact 16px padding. */
        tight: 'p-4',
        /** No padding — use when subcomponents own their own spacing. */
        flush: 'p-0',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface CardEbProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardEbVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardEbProps>(function Card(
  { className, variant, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="card-eb"
      data-variant={variant ?? 'default'}
      className={cn(cardEbVariants({ variant }), className)}
      {...props}
    />
  );
});

export interface CardEbHeadProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional right-aligned mono-styled meta slot. */
  meta?: React.ReactNode;
}

/** Top strip on a `flush` card — title left, meta right. */
const CardEbHead = React.forwardRef<HTMLDivElement, CardEbHeadProps>(function CardEbHead(
  { className, children, meta, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="card-eb-head"
      className={cn(
        'flex items-center gap-2.5 border-b border-border px-[18px] py-[14px] text-[13px] font-semibold',
        className,
      )}
      {...props}
    >
      {children}
      {meta != null ? (
        <span
          data-slot="card-eb-head-meta"
          className="ml-auto font-mono text-[11px] font-normal text-muted-foreground"
        >
          {meta}
        </span>
      ) : null}
    </div>
  );
});

export { Card, CardEbHead, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
// eslint-disable-next-line react-refresh/only-export-components
export { cardEbVariants };
