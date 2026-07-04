import * as React from 'react';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Derives up to 2 uppercase initials from a person name. Whitespace
 * separates tokens; punctuation is preserved within tokens but ignored
 * for the initial pick. Empty input yields `'?'`.
 */
function initialsFromName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return '?';
  }
  const letters = tokens
    .slice(0, 2)
    .map((t) => t[0] ?? '')
    .join('');
  return letters.toUpperCase() || '?';
}

const avatarEbVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground',
  {
    variants: {
      size: {
        /** 24px — compact list use. */
        sm: 'size-6 text-[10px]',
        /** 28px — design's default `.ava`. */
        default: 'size-7 text-[11px]',
        /** 36px — `.ava--lg`. */
        lg: 'size-9 text-[13px]',
      },
      accent: {
        /** Lime fill on dark text. */
        true: 'bg-[var(--accent)] text-[var(--accent-foreground)]',
        false: '',
      },
    },
    defaultVariants: { size: 'default', accent: false },
  },
);

export interface AvatarEbProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof avatarEbVariants> {
  /** Person or company name. Used to derive initials. */
  name: string;
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarEbProps>(function Avatar(
  { className, name, size, accent, ...props },
  ref,
) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      data-slot="avatar-eb"
      data-size={size ?? 'default'}
      data-accent={accent ? 'true' : 'false'}
      className={cn(avatarEbVariants({ size, accent }), className)}
      {...props}
    >
      {/* Render initials directly as Root children. The design never ships
          avatar images, so we bypass AvatarPrimitive.Fallback's delayMs +
          imageLoadingStatus dance and just paint the initials inline. */}
      <span
        data-slot="avatar-eb-fallback"
        className="flex size-full items-center justify-center font-semibold"
      >
        {initialsFromName(name)}
      </span>
    </AvatarPrimitive.Root>
  );
});

export { Avatar };
// eslint-disable-next-line react-refresh/only-export-components
export { avatarEbVariants, initialsFromName };
