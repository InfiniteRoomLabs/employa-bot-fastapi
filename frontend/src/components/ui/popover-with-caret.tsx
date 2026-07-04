import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { PopoverContent as ShadcnPopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Side of the popover the caret triangle attaches to. Matches the
 * `side` prop on shadcn `PopoverContent` semantically. `top` (default)
 * means the caret sits at the *top* of the popover, pointing at the
 * trigger which is above-anchor.
 */
export type PopoverCaretSide = 'top' | 'right' | 'bottom' | 'left';

export interface PopoverWithCaretProps extends React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> {
  /**
   * Render an 8px CSS triangle pointing back at the trigger. Set to
   * `false` (or omit and pass nothing) to suppress.
   */
  caret?: PopoverCaretSide;
}

/**
 * Class fragments that build a CSS-triangle pseudo-element via a single
 * `<div>` rotated 45deg. Edge of the popover the caret attaches to is
 * driven by the `caret` prop. The triangle inherits popover bg + border
 * so it visually fuses with the content.
 */
const caretClassesBySide: Record<PopoverCaretSide, string> = {
  top: 'left-1/2 -top-[5px] -translate-x-1/2 border-t border-l',
  right: 'top-1/2 -right-[5px] -translate-y-1/2 border-t border-r',
  bottom: 'left-1/2 -bottom-[5px] -translate-x-1/2 border-r border-b',
  left: 'top-1/2 -left-[5px] -translate-y-1/2 border-b border-l',
};

/**
 * `PopoverContent` with an attached caret triangle. Re-exports
 * shadcn's `Popover`, `PopoverTrigger`, `PopoverAnchor` unchanged
 * elsewhere; only the content is wrapped here so consumers can opt in
 * to the caret per-popover.
 */
const PopoverContentWithCaret = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  PopoverWithCaretProps
>(function PopoverContentWithCaret({ className, caret = 'top', children, ...props }, ref) {
  return (
    <ShadcnPopoverContent
      ref={ref}
      data-slot="popover-with-caret"
      data-caret={caret}
      className={cn('relative', className)}
      {...props}
    >
      <span
        aria-hidden
        data-slot="popover-caret"
        className={cn(
          'pointer-events-none absolute z-10 size-[10px] rotate-45 border-border bg-popover',
          caretClassesBySide[caret],
        )}
      />
      {children}
    </ShadcnPopoverContent>
  );
});

// Re-export the rest of the popover API for consumer convenience.
export { PopoverContentWithCaret };
export { Popover, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
