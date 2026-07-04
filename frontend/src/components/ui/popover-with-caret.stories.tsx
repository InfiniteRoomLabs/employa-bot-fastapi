import type { Meta, StoryObj } from '@storybook/react-vite';

import { Popover, PopoverContentWithCaret, PopoverTrigger } from './popover-with-caret';

const meta = {
  title: 'UI/Popover with caret',
  component: PopoverContentWithCaret,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PopoverContentWithCaret>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover open>
      <PopoverTrigger>Anchor</PopoverTrigger>
      <PopoverContentWithCaret>
        <p style={{ margin: 0 }}>Default caret at the top.</p>
      </PopoverContentWithCaret>
    </Popover>
  ),
};

export const CaretRight: Story = {
  render: () => (
    <Popover open>
      <PopoverTrigger>Anchor</PopoverTrigger>
      <PopoverContentWithCaret caret="right" side="left">
        <p style={{ margin: 0 }}>Caret on the right edge.</p>
      </PopoverContentWithCaret>
    </Popover>
  ),
};

export const CaretBottom: Story = {
  render: () => (
    <Popover open>
      <PopoverTrigger>Anchor</PopoverTrigger>
      <PopoverContentWithCaret caret="bottom" side="top">
        <p style={{ margin: 0 }}>Caret on the bottom edge.</p>
      </PopoverContentWithCaret>
    </Popover>
  ),
};

export const CaretLeft: Story = {
  render: () => (
    <Popover open>
      <PopoverTrigger>Anchor</PopoverTrigger>
      <PopoverContentWithCaret caret="left" side="right">
        <p style={{ margin: 0 }}>Caret on the left edge.</p>
      </PopoverContentWithCaret>
    </Popover>
  ),
};
