/**
 * Coach chat - 3-column layout (threads | conversation | context).
 *
 * Picker id: `coach`
 * Route path: `/coach` (Phase 9)
 *
 * Stories implemented:
 *   COA-019 - 3-pane hub verified/wired with per-pane skeleton and error states
 *   COA-020 - thread list + scope badges as nav IA; active prop passed to CoachThreadRow
 *   COA-021 - context pane shows per-thread cards via useCoachThread
 *   CUR-017 - ResourceError in both threads pane and conversation pane
 *   CUR-024 - EmptyState for no-threads and no-messages cases
 */

import { MessageCircleIcon, PlusIcon, SendIcon } from "lucide-react"
import * as React from "react"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { CoachContextCard } from "@/components/domain/coach-context-card"
import { CoachMessage } from "@/components/domain/coach-message"
import { CoachThreadRow } from "@/components/domain/coach-thread-row"
import { AppFrame } from "@/components/shell/app-frame"
import { Button } from "@/components/ui/button-eb"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { ContextCard } from "@/data/types"
import { useCoachThread, useCoachThreads } from "@/hooks"

export default function CoachScreen() {
  const {
    data: threads,
    isLoading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useCoachThreads()

  const [activeId, setActiveId] = React.useState<string | undefined>(undefined)
  const threadId = activeId ?? threads?.[0]?.id ?? ""

  const {
    data: thread,
    isLoading: threadLoading,
    error: threadError,
    refetch: refetchThread,
  } = useCoachThread(threadId)

  // COA-022: local context cards (mock). Seeded from the thread's context; the
  // user can add (upload / pick from their library) and remove items. Resets
  // when the active thread changes.
  const [contextCards, setContextCards] = React.useState<
    readonly ContextCard[]
  >([])
  React.useEffect(() => {
    if (thread) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContextCards(thread.context)
    }
  }, [thread])

  function handleAddContextFromLibrary() {
    setContextCards((cards) => [
      ...cards,
      {
        label: "Added from your library",
        body: "Master resume v4 (you entered this earlier)",
      },
    ])
    toast.success({
      title: "Added to context",
      sub: "The coach will read this in replies.",
    })
  }
  function handleUploadContext() {
    setContextCards((cards) => [
      ...cards,
      { label: "Uploaded file", body: "context-note.pdf (mock upload)" },
    ])
    toast.success({
      title: "File added to context",
      sub: "(mock) The coach now reads it.",
    })
  }
  function handleRemoveContext(indexToRemove: number) {
    setContextCards((cards) =>
      cards.filter((_, index) => index !== indexToRemove),
    )
  }

  return (
    <AppFrame
      active="coach"
      title="Coach"
      subtitle="Scoped conversations - thumbs feedback"
      bleed
    >
      <div className="grid h-full grid-cols-[280px_1fr_340px]">
        {/* ---------------------------------------------------------------- */}
        {/* Threads pane (COA-020)                                           */}
        {/* ---------------------------------------------------------------- */}
        <aside className="overflow-y-auto border-r border-border bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Input
              placeholder="Search threads..."
              className="h-8 text-[12px]"
            />
            <Button variant="ghost" size="icon" aria-label="New thread">
              <PlusIcon className="size-3.5" />
            </Button>
          </div>

          {/* CUR-017: threads error */}
          {threadsError && !threadsLoading && (
            <div className="p-3">
              <ResourceError
                label="threads"
                error={threadsError}
                onRetry={refetchThreads}
              />
            </div>
          )}

          {/* Loading */}
          {threadsLoading && <Skeleton className="m-3 h-40" />}

          {/* CUR-024: no threads */}
          {!threadsLoading &&
            !threadsError &&
            threads &&
            threads.length === 0 && (
              <EmptyState
                icon={MessageCircleIcon}
                headline="No threads yet"
                body="Start a conversation with the coach."
                className="px-3 py-8"
              />
            )}

          {/* Thread list -- COA-020: pass active prop to CoachThreadRow */}
          {!threadsLoading &&
            !threadsError &&
            threads &&
            threads.length > 0 &&
            threads.map((coachThread) => (
              <CoachThreadRow
                key={coachThread.id}
                thread={coachThread}
                active={coachThread.id === threadId}
                onClick={() => setActiveId(coachThread.id)}
              />
            ))}
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Conversation pane (COA-019)                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {/* CUR-017: thread error */}
            {threadError && !threadLoading && (
              <ResourceError
                label="conversation"
                error={threadError}
                onRetry={refetchThread}
              />
            )}

            {/* Loading */}
            {threadLoading && !threadError && <Skeleton className="h-96" />}

            {/* CUR-024: empty conversation (other threads have no messages yet) */}
            {!threadLoading &&
              !threadError &&
              thread &&
              thread.messages.length === 0 && (
                <EmptyState
                  icon={MessageCircleIcon}
                  headline="No messages yet"
                  body={`Ask the coach about this ${thread.thread.scope} conversation.`}
                />
              )}

            {/* Messages */}
            {!threadLoading &&
              !threadError &&
              thread &&
              thread.messages.length > 0 && (
                <div className="flex flex-col gap-4">
                  {thread.messages.map((message) => (
                    <CoachMessage key={message.id} message={message} />
                  ))}
                </div>
              )}
          </div>

          {/* Input bar */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-2">
              <Input placeholder="Ask the coach..." className="flex-1" />
              <Button variant="default">
                <SendIcon className="size-3.5" /> Send
              </Button>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Context pane (COA-021) -- per-thread context cards               */}
        {/* ---------------------------------------------------------------- */}
        <aside className="overflow-y-auto border-l border-border bg-[var(--bg-subtle)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Context
            </h3>
          </div>

          {/* CUR-017: reuse thread error state (context comes from same hook) */}
          {threadError && !threadLoading && (
            <ResourceError
              label="context"
              error={threadError}
              onRetry={refetchThread}
            />
          )}

          {/* Loading */}
          {threadLoading && !threadError && <Skeleton className="h-40" />}

          {/* Context cards -- per-thread (COA-021), add/remove (COA-022) */}
          {!threadLoading && !threadError && thread && (
            <div className="flex flex-col gap-3">
              {contextCards.map((contextCard, index) => (
                <CoachContextCard
                  key={`${contextCard.label}-${index}`}
                  card={contextCard}
                  onRemove={() => handleRemoveContext(index)}
                />
              ))}
              {/* COA-022: add context via upload or from the user's library. */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={handleAddContextFromLibrary}
                >
                  <PlusIcon className="size-3.5" /> From library
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={handleUploadContext}
                >
                  Upload
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </AppFrame>
  )
}
