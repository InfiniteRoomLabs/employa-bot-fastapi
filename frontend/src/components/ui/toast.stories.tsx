import type { Meta, StoryObj } from '@storybook/react-vite';

import { toast, Toaster } from './toast';

const meta = {
  title: 'UI/Toast',
  component: Toaster,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function Trigger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--fg)',
        padding: '8px 14px',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

export const Playground: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Toaster />
      <Trigger
        label="Success + Undo"
        onClick={() =>
          toast.success({
            title: 'Marked Stripe as APPLIED.',
            sub: 'Tailored "Distributed-systems v4" -> locked.',
            undo: { onUndo: () => undefined },
          })
        }
      />
      <Trigger
        label="Agent"
        onClick={() =>
          toast.agent({
            title: 'Coach drafted a follow-up for you.',
            sub: 'Review and send when ready.',
            cta: { label: 'Open draft' },
          })
        }
      />
      <Trigger
        label="Warn"
        onClick={() =>
          toast.warn({
            title: "Couldn't fully parse that posting.",
            sub: 'Fill 2 missing fields to continue.',
            cta: { label: 'Review' },
          })
        }
      />
      <Trigger
        label="Error"
        onClick={() =>
          toast.error({
            title: 'Gemini key failed - match scoring paused.',
            sub: 'Using Anthropic fallback for now.',
            cta: { label: 'Fix key' },
          })
        }
      />
      <Trigger
        label="Celebrate"
        onClick={() =>
          toast.celebrate({
            title: 'Offer received from Vercel!',
            sub: '$265k base + equity, respond by Apr 19.',
            cta: { label: 'Open' },
          })
        }
      />
      <Trigger label="Default" onClick={() => toast.default({ title: 'Heads up.' })} />
    </div>
  ),
};
