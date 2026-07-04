import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Popover, PopoverContentWithCaret, PopoverTrigger } from './popover-with-caret';

function Harness({ caret }: { caret?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Popover>
      <PopoverTrigger>Open menu</PopoverTrigger>
      <PopoverContentWithCaret caret={caret}>
        <p>Popover body</p>
      </PopoverContentWithCaret>
    </Popover>
  );
}

describe('PopoverContentWithCaret', () => {
  it('opens on trigger click and shows the content', async () => {
    render(<Harness />);
    expect(screen.queryByText('Popover body')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(await screen.findByText('Popover body')).toBeInTheDocument();
  });

  it('defaults to top caret side', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
    const content = await screen.findByText('Popover body');
    expect(content.closest('[data-slot=popover-with-caret]')).toHaveAttribute('data-caret', 'top');
  });

  it('honors caret prop', async () => {
    render(<Harness caret="right" />);
    await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
    const content = await screen.findByText('Popover body');
    expect(content.closest('[data-slot=popover-with-caret]')).toHaveAttribute(
      'data-caret',
      'right',
    );
  });

  it('closes on Escape', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(await screen.findByText('Popover body')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Popover body')).not.toBeInTheDocument();
  });
});
