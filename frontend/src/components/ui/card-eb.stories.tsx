import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Card,
  CardContent,
  CardDescription,
  CardEbHead,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card-eb';

const meta = {
  title: 'UI/Card (extended)',
  component: Card,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <CardHeader>
        <CardTitle>Stripe · Staff Engineer</CardTitle>
        <CardDescription>Remote · $265k base</CardDescription>
      </CardHeader>
      <CardContent>body content slot</CardContent>
      <CardFooter>foot</CardFooter>
    </Card>
  ),
};

export const Tight: Story = {
  render: () => (
    <Card variant="tight" style={{ width: 360 }}>
      <CardTitle>Tight padding</CardTitle>
      <CardDescription>16px instead of 24px.</CardDescription>
    </Card>
  ),
};

export const Flush: Story = {
  render: () => (
    <Card variant="flush" style={{ width: 360 }}>
      <CardEbHead meta="6 items">Recent applications</CardEbHead>
      <CardContent>
        <p style={{ padding: 16, margin: 0 }}>Card body owns its own spacing.</p>
      </CardContent>
    </Card>
  ),
};

export const FlushWithMeta: Story = {
  render: () => (
    <Card variant="flush" style={{ width: 480 }}>
      <CardEbHead meta="updated 12m ago">Jobs inbox</CardEbHead>
      <CardContent>
        <p style={{ padding: 16, margin: 0 }}>Inbox rows would render here.</p>
      </CardContent>
    </Card>
  ),
};
