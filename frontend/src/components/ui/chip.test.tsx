import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Chip } from './chip';

describe('Chip', () => {
  it('renders label', () => {
    render(<Chip>Remote</Chip>);
    expect(screen.getByRole('button', { name: /remote/i })).toBeInTheDocument();
  });

  it('toggles pressed state on click (uncontrolled)', async () => {
    render(<Chip>Saved</Chip>);
    const chip = screen.getByRole('button', { name: /saved/i });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('respects controlled pressed prop', () => {
    render(
      <Chip pressed onPressedChange={() => {}}>
        Active
      </Chip>,
    );
    expect(screen.getByRole('button', { name: /active/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onPressedChange when toggled', async () => {
    const onPressedChange = vi.fn();
    render(<Chip onPressedChange={onPressedChange}>Tap</Chip>);
    await userEvent.click(screen.getByRole('button', { name: /tap/i }));
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it('responds to keyboard (Space)', async () => {
    const onPressedChange = vi.fn();
    render(<Chip onPressedChange={onPressedChange}>Kbd</Chip>);
    const chip = screen.getByRole('button', { name: /kbd/i });
    chip.focus();
    await userEvent.keyboard(' ');
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it('renders trailing count', () => {
    render(<Chip count={12}>Inbox</Chip>);
    expect(screen.getByRole('button', { name: /inbox/i })).toHaveTextContent('12');
  });

  it('reflects variant via data attribute', () => {
    render(<Chip variant="exclude">No remote</Chip>);
    expect(screen.getByRole('button', { name: /no remote/i })).toHaveAttribute(
      'data-variant',
      'exclude',
    );
  });
});
