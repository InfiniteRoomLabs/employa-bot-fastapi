import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from './button-eb';

describe('Button (extended)', () => {
  it('renders accessible name', () => {
    render(<Button>Apply now</Button>);
    expect(screen.getByRole('button', { name: /apply now/i })).toBeInTheDocument();
  });

  it('handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tap</Button>);
    await userEvent.click(screen.getByRole('button', { name: /tap/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reflects variant via data attribute', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: /delete/i })).toHaveAttribute(
      'data-variant',
      'danger',
    );
  });

  it('reflects size via data attribute', () => {
    render(<Button size="lg">Hero</Button>);
    expect(screen.getByRole('button', { name: /hero/i })).toHaveAttribute('data-size', 'lg');
  });

  it('honors caller className over base styles', () => {
    render(
      <Button className="custom-test-class" variant="ghost">
        X
      </Button>,
    );
    expect(screen.getByRole('button', { name: /x/i })).toHaveClass('custom-test-class');
  });

  it('asChild composes onto child element', () => {
    render(
      <Button asChild>
        <a href="/jobs">Browse jobs</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: /browse jobs/i });
    expect(link).toHaveAttribute('href', '/jobs');
    expect(link).toHaveAttribute('data-slot', 'button-eb');
  });

  it('renders leading icon before children', () => {
    render(<Button icon={<span data-testid="lead-icon">+</span>}>Add</Button>);
    const btn = screen.getByRole('button', { name: /add/i });
    expect(btn).toContainElement(screen.getByTestId('lead-icon'));
  });
});
