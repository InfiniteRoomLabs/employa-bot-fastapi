import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Chip } from './chip';

const meta = {
  title: 'UI/Chip',
  component: Chip,
  parameters: { layout: 'centered' },
  args: { children: 'Remote' },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: 'default' } };
export const Accent: Story = {
  args: { variant: 'accent', defaultPressed: true, children: 'Tailored' },
};
export const Dash: Story = { args: { variant: 'dash', children: '+ Add filter' } };
export const Exclude: Story = {
  args: { variant: 'exclude', children: 'Exclude: contractor' },
};

export const WithCount: Story = { args: { count: 12, children: 'Inbox' } };

export const Pressed: Story = { args: { defaultPressed: true, children: 'Saved' } };

export const Controlled: Story = {
  render: () => {
    const ControlledChip = () => {
      const [pressed, setPressed] = useState(false);
      return (
        <Chip pressed={pressed} onPressedChange={setPressed} variant="accent">
          Click me · {pressed ? 'on' : 'off'}
        </Chip>
      );
    };
    return <ControlledChip />;
  },
};

export const FilterRow: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Chip defaultPressed>All</Chip>
      <Chip count={5}>Replies</Chip>
      <Chip count={3}>Agents</Chip>
      <Chip count={6}>Matches</Chip>
      <Chip variant="dash">+ Add</Chip>
    </div>
  ),
};
