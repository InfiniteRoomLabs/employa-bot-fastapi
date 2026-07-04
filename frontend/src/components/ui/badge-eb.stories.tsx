import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge-eb';

const meta = {
  title: 'UI/Badge (extended)',
  component: Badge,
  parameters: { layout: 'centered' },
  args: { children: '92% match' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: 'default', children: 'Stage' } };
export const Accent: Story = { args: { variant: 'accent', children: '92% match' } };
export const Warn: Story = { args: { variant: 'warn', children: 'Stale' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Rejected' } };
export const Info: Story = { args: { variant: 'info', children: 'Screen' } };
export const Success: Story = { args: { variant: 'success', children: 'Offer' } };

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge variant="default">default</Badge>
      <Badge variant="accent">accent</Badge>
      <Badge variant="warn">warn</Badge>
      <Badge variant="danger">danger</Badge>
      <Badge variant="info">info</Badge>
      <Badge variant="success">success</Badge>
    </div>
  ),
};
