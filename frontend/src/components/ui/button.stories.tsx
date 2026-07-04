import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';

/**
 * Phase 3 smoke test: confirms the shadcn -> IRL token bridge is wired.
 * The Default story should render with the design's lime accent
 * (--primary -> var(--lime-300)) and dark text on it
 * (--primary-foreground -> var(--slate-950)). If you see a slate-gray
 * primary button, the bridge is misconfigured or out of order in main.tsx.
 */
const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  args: {
    children: 'Apply now',
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: 'default' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Outline: Story = {
  args: { variant: 'outline' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
};

export const Link: Story = {
  args: { variant: 'link' },
};
