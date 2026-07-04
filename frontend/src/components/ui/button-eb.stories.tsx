import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button-eb';

const meta = {
  title: 'UI/Button (extended)',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Apply now' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: 'default' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete' } };

export const SizeSm: Story = { args: { size: 'sm', children: 'Compact' } };
export const SizeLg: Story = { args: { size: 'lg', children: 'Hero CTA' } };
export const IconOnly: Story = {
  args: { size: 'icon', children: '+', 'aria-label': 'Add' },
};

export const WithLeadingIcon: Story = {
  args: { icon: <span>+</span>, children: 'Add resume' },
};

export const AsChildAnchor: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="#jobs">Browse jobs</a>
    </Button>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
