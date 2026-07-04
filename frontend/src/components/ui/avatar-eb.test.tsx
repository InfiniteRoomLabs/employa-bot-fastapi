import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Avatar, initialsFromName } from './avatar-eb';

describe('initialsFromName', () => {
  it('returns two-letter uppercase initials for two tokens', () => {
    expect(initialsFromName('Riley Chen')).toBe('RC');
  });

  it('returns one initial for a single token', () => {
    expect(initialsFromName('Stripe')).toBe('S');
  });

  it('caps at two tokens', () => {
    expect(initialsFromName('Mary Jane Watson')).toBe('MJ');
  });

  it('falls back to `?` for empty input', () => {
    expect(initialsFromName('  ')).toBe('?');
  });
});

describe('Avatar (extended)', () => {
  it('renders initials derived from name', () => {
    render(<Avatar name="Riley Chen" aria-label="Riley" />);
    expect(screen.getByText('RC')).toBeInTheDocument();
  });

  it('defaults to default size', () => {
    render(<Avatar name="Stripe" data-testid="av" />);
    expect(screen.getByTestId('av')).toHaveAttribute('data-size', 'default');
  });

  it.each(['sm', 'default', 'lg'] as const)('reflects %s size', (size) => {
    render(<Avatar name="A B" size={size} data-testid="av" />);
    expect(screen.getByTestId('av')).toHaveAttribute('data-size', size);
  });

  it('marks accent variant', () => {
    render(<Avatar name="Ava" accent data-testid="av" />);
    expect(screen.getByTestId('av')).toHaveAttribute('data-accent', 'true');
  });
});
