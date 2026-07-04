import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from './avatar-eb';

const meta = {
  title: 'UI/Avatar (extended)',
  component: Avatar,
  parameters: { layout: 'centered' },
  args: { name: 'Riley Chen' },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
export const Accent: Story = { args: { accent: true, name: 'Ava Bot' } };
export const AccentLarge: Story = { args: { accent: true, size: 'lg', name: 'Ava Bot' } };

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name="Riley Chen" size="sm" />
      <Avatar name="Riley Chen" />
      <Avatar name="Riley Chen" size="lg" />
      <Avatar name="Ava Bot" accent />
    </div>
  ),
};

export const NamesAndInitials: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <Avatar name="Riley Chen" />
      <Avatar name="Stripe" />
      <Avatar name="Mary Jane Watson" />
      <Avatar name="Vercel Labs" size="lg" />
    </div>
  ),
};
