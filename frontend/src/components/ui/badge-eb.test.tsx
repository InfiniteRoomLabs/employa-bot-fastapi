import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Badge } from './badge-eb';

describe('Badge (extended)', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('defaults to the default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveAttribute('data-variant', 'default');
  });

  it.each(['accent', 'warn', 'danger', 'info', 'success'] as const)(
    'reflects %s variant',
    (variant) => {
      render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toHaveAttribute('data-variant', variant);
    },
  );

  it('caller className overrides base', () => {
    render(<Badge className="custom-test-class">Tag</Badge>);
    expect(screen.getByText('Tag')).toHaveClass('custom-test-class');
  });

  it('asChild composes onto provided element', () => {
    render(
      <Badge asChild variant="accent">
        <a href="/x">Linked</a>
      </Badge>,
    );
    expect(screen.getByRole('link', { name: /linked/i })).toHaveAttribute('data-slot', 'badge-eb');
  });
});
