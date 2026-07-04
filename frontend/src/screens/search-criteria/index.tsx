/**
 * Search criteria config screen -- dual-mode:
 *
 * CREATE mode  /searches/criteria      (no :id in URL)
 *   - All chip arrays empty, name field at top
 *   - PageHead title "New search"
 *   - Status sidebar hidden
 *   - Primary action: "Create search" (validates name, calls useCreateSearch,
 *     navigates to new search's detail screen)
 *   - Secondary action: "Cancel" (navigate(-1))
 *
 * EDIT mode    /searches/:id/criteria  (:id in URL)
 *   - Loads the target search via useSearch(id)
 *   - Seeds local working state once from data
 *   - Dirty check via useMemo(JSON.stringify comparison)
 *   - Primary action when dirty: "Save" (calls useUpdateSearchCriteria,
 *     toast.success on resolve, toast.error on failure)
 *   - Secondary action when dirty: "Discard" (reverts working copy)
 *   - Status sidebar card shows applications / shortlisted / spendMo
 *   - CUR-017: error -> <ResourceError onRetry={refetch} />,
 *              not_found -> <ResourceError notFound backTo="/searches/..." />
 *
 * Stories: ADD-006, ADD-010
 * Contracts: CUR-017 (error/not-found), ORI-014 (toast feedback)
 */

import { CheckIcon, PauseIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { FormField } from "@/components/atoms/form-field"
import { ResourceError } from "@/components/atoms/resource-error"
import { Section } from "@/components/atoms/section"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { BLANK_CRITERIA, SEARCH_ID_PLATFORM } from "@/data/fixtures"
import type { SearchCriteria } from "@/data/types"
import { useCreateSearch, useSearch, useUpdateSearchCriteria } from "@/hooks"

// ---------------------------------------------------------------------------
// ChipList -- editable chip array (add + remove)
// ---------------------------------------------------------------------------

interface ChipListProps {
  values: string[]
  onChange: (values: string[]) => void
  addLabel?: string
  disabled?: boolean
}

function ChipList({
  values,
  onChange,
  addLabel = "+ Add",
  disabled = false,
}: ChipListProps) {
  const [adding, setAdding] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setDraft("")
    setAdding(false)
  }

  const remove = (val: string) => {
    onChange(values.filter((value) => value !== val))
  }

  React.useEffect(() => {
    if (adding) {
      inputRef.current?.focus()
    }
  }, [adding])

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--border-strong)] bg-foreground px-2.5 text-xs font-medium text-background"
        >
          {value}
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${value}`}
              className="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
              onClick={() => remove(value)}
            >
              <XIcon className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled &&
        (adding ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-[var(--border-strong)] bg-card px-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commit()
                }
                if (event.key === "Escape") {
                  setDraft("")
                  setAdding(false)
                }
              }}
              onBlur={commit}
              className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              placeholder="Type and press Enter"
            />
          </span>
        ) : (
          <Chip variant="dash" onClick={() => setAdding(true)}>
            <PlusIcon className="size-3" />
            {addLabel}
          </Chip>
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RemotePolicyPicker
// ---------------------------------------------------------------------------

type RemotePolicy = "OK" | "Hybrid OK" | "Required"
const REMOTE_OPTS: RemotePolicy[] = ["OK", "Hybrid OK", "Required"]

interface RemotePolicyPickerProps {
  value: RemotePolicy
  onChange: (v: RemotePolicy) => void
}

function RemotePolicyPicker({ value, onChange }: RemotePolicyPickerProps) {
  return (
    <div className="flex gap-1.5">
      {REMOTE_OPTS.map((opt) => (
        <Chip
          key={opt}
          pressed={value === opt}
          onPressedChange={(pressed) => {
            if (pressed) {
              onChange(opt)
            }
          }}
        >
          {opt}
        </Chip>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Criteria form body -- shared between create and edit modes
// ---------------------------------------------------------------------------

interface CriteriaFormBodyProps {
  working: SearchCriteria
  setWorking: React.Dispatch<React.SetStateAction<SearchCriteria>>
}

function CriteriaFormBody({ working, setWorking }: CriteriaFormBodyProps) {
  const patch = (partial: Partial<SearchCriteria>) =>
    setWorking((prev) => ({ ...prev, ...partial }))

  return (
    <>
      <Section
        title="Titles"
        subtitle="Roles you'd consider, plus exclusions for noise reduction."
      >
        <FormField label="Include">
          <ChipList
            values={working.titlesInclude}
            onChange={(value) => patch({ titlesInclude: value })}
            addLabel="Add title"
          />
        </FormField>
        <FormField label="Exclude">
          <ChipList
            values={working.titlesExclude}
            onChange={(value) => patch({ titlesExclude: value })}
            addLabel="Add exclusion"
          />
        </FormField>
      </Section>

      <Section title="Where" subtitle="Locations + commute tolerance.">
        <FormField label="Locations">
          <ChipList
            values={working.locations}
            onChange={(value) => patch({ locations: value })}
            addLabel="Add location"
          />
        </FormField>
        <FormField label="Remote policy">
          <RemotePolicyPicker
            value={working.remotePolicy}
            onChange={(value) => patch({ remotePolicy: value })}
          />
        </FormField>
        <FormField label="Max commute (on-site)">
          <Input
            value={String(working.maxCommuteMin) + " min"}
            onChange={(event) => {
              const raw = parseInt(event.target.value, 10)
              if (!isNaN(raw)) {
                patch({ maxCommuteMin: raw })
              }
            }}
            className="max-w-40"
          />
        </FormField>
      </Section>

      <Section title="Comp & seniority">
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Base floor">
            <Input
              value={working.baseFloor}
              onChange={(event) => patch({ baseFloor: event.target.value })}
            />
          </FormField>
          <FormField label="Base ceiling">
            <Input
              value={working.baseCeiling}
              onChange={(event) => patch({ baseCeiling: event.target.value })}
            />
          </FormField>
          <FormField label="Years experience">
            <Input
              value={working.yearsExperience}
              onChange={(event) =>
                patch({ yearsExperience: event.target.value })
              }
            />
          </FormField>
        </div>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SearchCriteriaScreen() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()

  const isEditMode = params.id !== undefined
  const searchId = params.id ?? ""

  // Edit mode: load the target search
  const { data, isLoading, error, refetch } = useSearch(
    isEditMode ? searchId : SEARCH_ID_PLATFORM,
  )

  // Mutation hooks
  const { createSearch, isCreating } = useCreateSearch()
  const { updateCriteria, isSaving } = useUpdateSearchCriteria()

  // -------------------------------------------------------------------------
  // Working state -- criteria form fields
  // -------------------------------------------------------------------------

  const [working, setWorking] = React.useState<SearchCriteria>(BLANK_CRITERIA)
  const [seedDone, setSeedDone] = React.useState(false)

  // In edit mode: seed working state once from loaded data
  React.useEffect(() => {
    if (isEditMode && data && !seedDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorking({ ...data.criteria })

      setSeedDone(true)
    }
  }, [isEditMode, data, seedDone])

  // In create mode: working is always BLANK_CRITERIA (set once at mount)
  React.useEffect(() => {
    if (!isEditMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorking({ ...BLANK_CRITERIA })

      setSeedDone(false)
    }
  }, [isEditMode])

  // -------------------------------------------------------------------------
  // Create-mode fields
  // -------------------------------------------------------------------------
  const [searchName, setSearchName] = React.useState("")
  const [nameError, setNameError] = React.useState("")

  // ORI-014: local paused state for the "Pause search" action (mock).
  const [searchPaused, setSearchPaused] = React.useState(false)
  function handleTogglePauseSearch() {
    setSearchPaused((wasPaused) => {
      const nowPaused = !wasPaused
      toast.success({
        title: nowPaused ? "Search paused" : "Search resumed",
        sub: nowPaused
          ? "Parked - not actively pursuing this scope."
          : "This scope is active again.",
      })
      return nowPaused
    })
  }

  // Reset create state when switching to create mode
  React.useEffect(() => {
    if (!isEditMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchName("")

      setNameError("")
    }
  }, [isEditMode])

  // -------------------------------------------------------------------------
  // Dirty check (edit mode only)
  // -------------------------------------------------------------------------
  const isDirty = React.useMemo(() => {
    if (!isEditMode || !data) {
      return false
    }
    return JSON.stringify(working) !== JSON.stringify(data.criteria)
  }, [isEditMode, data, working])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    if (!isEditMode || !searchId) {
      return
    }
    try {
      await updateCriteria({ id: searchId, criteria: working })
      toast.success({ title: "Search criteria saved" })
    } catch {
      toast.error({
        title: "Could not save criteria",
        sub: "Try again in a moment.",
      })
    }
  }

  const handleDiscard = () => {
    if (data) {
      setWorking({ ...data.criteria })
    }
  }

  const handleCreate = async () => {
    const trimmed = searchName.trim()
    if (!trimmed) {
      setNameError("Give your search a name")
      return
    }
    setNameError("")
    try {
      const newSearch = await createSearch({
        name: trimmed,
        criteria: working,
      })
      toast.success({ title: "Search created", sub: trimmed })
      navigate(`/searches/${newSearch.id}`)
    } catch {
      toast.error({
        title: "Could not create search",
        sub: "Something went wrong. Try again.",
      })
    }
  }

  const handleCancel = () => {
    navigate(-1)
  }

  // -------------------------------------------------------------------------
  // CUR-017: edit-mode error/not-found branching
  // -------------------------------------------------------------------------

  if (isEditMode && !isLoading && error) {
    const isNotFound = error.kind === "not_found"
    const fallbackId = SEARCH_ID_PLATFORM

    return (
      <AppFrame
        active="search-detail"
        title="Search criteria"
        subtitle="Edit search configuration"
      >
        <PageHead title="Search criteria" />
        <div className="mt-8">
          {isNotFound ? (
            <ResourceError
              label="This search"
              notFound
              backLabel="Back to searches"
              backTo={`/searches/${fallbackId}`}
            />
          ) : (
            <ResourceError
              label="search criteria"
              error={error}
              onRetry={refetch}
            />
          )}
        </div>
      </AppFrame>
    )
  }

  // -------------------------------------------------------------------------
  // Derived UI values
  // -------------------------------------------------------------------------

  const screenTitle = isEditMode
    ? (data?.name ?? "Search criteria")
    : "New search"

  const eyebrow = isEditMode ? (data?.eyebrow ?? "") : ""

  const activeId = isEditMode ? "search-detail" : "search-criteria"

  const actions = isEditMode ? (
    <>
      {isDirty ? (
        <>
          <Button variant="ghost" onClick={handleDiscard} disabled={isSaving}>
            <XIcon className="size-3.5" /> Discard
          </Button>
          <Button variant="default" onClick={handleSave} disabled={isSaving}>
            <CheckIcon className="size-3.5" /> {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={handleTogglePauseSearch}>
          <PauseIcon className="size-3.5" />{" "}
          {searchPaused ? "Resume search" : "Pause search"}
        </Button>
      )}
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={handleCancel} disabled={isCreating}>
        Cancel
      </Button>
      <Button variant="default" onClick={handleCreate} disabled={isCreating}>
        <SearchIcon className="size-3.5" />
        {isCreating ? "Creating..." : "Create search"}
      </Button>
    </>
  )

  return (
    <AppFrame
      active={activeId}
      title={isEditMode ? `Search criteria - ${screenTitle}` : "New search"}
      subtitle={
        isEditMode
          ? "What we look for, what we ignore"
          : "Set up a new saved search"
      }
    >
      <PageHead
        eyebrow={eyebrow || undefined}
        title={
          isEditMode ? (
            isLoading ? (
              <Skeleton className="inline-block h-9 w-64" />
            ) : (
              screenTitle
            )
          ) : (
            "New search"
          )
        }
        lede={
          isEditMode
            ? "What we look for, what we ignore, how often we run, and when we should ping you."
            : "Give your search a name and configure what we look for."
        }
        actions={actions}
      />

      <div
        className={
          isEditMode
            ? "grid grid-cols-[1fr_320px] items-start gap-6"
            : "flex flex-col gap-3.5 max-w-2xl"
        }
      >
        {/* Left column: form */}
        <div className="flex flex-col gap-3.5">
          {/* Create mode: name field */}
          {!isEditMode && (
            <Section
              title="Search name"
              subtitle="Give this search a label you'll recognize."
            >
              <FormField label="Name" required>
                <Input
                  value={searchName}
                  onChange={(event) => {
                    setSearchName(event.target.value)
                    if (event.target.value.trim()) {
                      setNameError("")
                    }
                  }}
                  placeholder="e.g. Remote Staff IC - Platform"
                  aria-invalid={nameError ? "true" : undefined}
                />
                {nameError && (
                  <p role="alert" className="mt-1 text-xs text-[var(--danger)]">
                    {nameError}
                  </p>
                )}
              </FormField>
            </Section>
          )}

          {/* Edit mode: show skeleton during initial load */}
          {isEditMode && isLoading && !seedDone ? (
            <div className="flex flex-col gap-3.5">
              <Skeleton className="h-40" />
              <Skeleton className="h-48" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <CriteriaFormBody working={working} setWorking={setWorking} />
          )}
        </div>

        {/* Right column: status sidebar (edit mode only) */}
        {isEditMode && (
          <aside className="card sticky top-4 flex flex-col gap-3 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Search status
            </div>
            {isLoading || !data ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <div className="flex items-center justify-between text-[13px]">
                  <span>Applications</span>
                  <span className="mono text-[var(--fg-muted)]">
                    {data.activeApplications}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span>Shortlisted</span>
                  <span className="mono text-[var(--fg-muted)]">
                    {data.shortlisted}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span>Spend / mo</span>
                  <span className="mono text-[var(--fg-muted)]">
                    {data.spendMo}
                  </span>
                </div>
                <Badge variant="accent">
                  {data.state === "paused" ? "paused" : "active"}
                </Badge>
              </>
            )}
          </aside>
        )}
      </div>
    </AppFrame>
  )
}
