import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { toast, Toaster } from './toast';

describe('toast helpers', () => {
  it('renders a success toast with title and sub', async () => {
    render(<Toaster />);
    toast.success({ title: 'Saved', sub: 'Resume v3 locked.' });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Resume v3 locked.')).toBeInTheDocument();
  });

  it('renders an agent toast with bot pill', async () => {
    render(<Toaster />);
    toast.agent({ title: 'Coach drafted a follow-up' });
    expect(await screen.findByText('Coach drafted a follow-up')).toBeInTheDocument();
    expect(screen.getByText('Coach')).toBeInTheDocument();
  });

  it('invokes undo callback when the undo button is pressed', async () => {
    render(<Toaster />);
    let undone = false;
    toast.success({
      title: 'Marked applied',
      undo: { onUndo: () => (undone = true) },
    });
    const btn = await screen.findByRole('button', { name: /undo/i });
    await userEvent.click(btn);
    expect(undone).toBe(true);
  });

  it('renders a persist error toast with close affordance', async () => {
    render(<Toaster />);
    toast.error({ title: 'Key failed', cta: { label: 'Fix key' } });
    expect(await screen.findByText('Key failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fix key/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });
});
