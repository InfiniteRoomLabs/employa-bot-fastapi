/**
 * Contacts (CON-001/002). Form-driven list of people in the user's search.
 * References (CON-002) are a tagged role -- a filter over the one Contacts list,
 * not a separate store.
 */

import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react"
import * as React from "react"
import { EmptyState } from "@/components/atoms/empty-state"
import { FormField } from "@/components/atoms/form-field"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ContactDraft } from "@/data/api"
import type { Contact } from "@/data/types"
import { useContacts, useLibraryMutations } from "@/hooks"

type Filter = "all" | "references"

const EMPTY: ContactDraft = {
  name: "",
  role: "",
  org: "",
  email: "",
  phone: "",
  relationship: "",
  isReference: false,
  tags: [],
  links: [],
  notes: "",
}

function toDraft(c: Contact): ContactDraft {
  return {
    name: c.name,
    role: c.role,
    org: c.org,
    email: c.email,
    phone: c.phone,
    relationship: c.relationship,
    isReference: c.isReference,
    tags: c.tags,
    links: c.links,
    notes: c.notes,
  }
}

export default function ContactsScreen() {
  const { data, isLoading, error, refetch } = useContacts()
  const { createContact, updateContact, deleteContact, isMutating } =
    useLibraryMutations()

  const [filter, setFilter] = React.useState<Filter>("all")
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<ContactDraft>(EMPTY)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (c: Contact) => {
    setEditing(c)
    setForm(toDraft(c))
    setOpen(true)
  }

  const save = async () => {
    if (form.name.trim().length === 0) {
      toast.warn({ title: "Name is required" })
      return
    }
    try {
      if (editing) {
        await updateContact(editing.id, form)
        toast.success({ title: "Contact updated" })
      } else {
        await createContact(form)
        toast.success({ title: "Contact added" })
      }
      setOpen(false)
      refetch()
    } catch {
      toast.error({ title: "Could not save contact" })
    }
  }

  const remove = async (c: Contact) => {
    try {
      await deleteContact(c.id)
      toast.success({ title: "Contact removed" })
      refetch()
    } catch {
      toast.error({ title: "Could not remove contact" })
    }
  }

  const rows = (data ?? []).filter((c) =>
    filter === "references" ? c.isReference : true,
  )

  return (
    <AppFrame
      active="contacts"
      title="Contacts"
      subtitle={`${data?.length ?? 0} people`}
    >
      <PageHead
        eyebrow="Library"
        title="Contacts"
        lede="Recruiters, hiring managers, and networking contacts you reuse across applications. Mark anyone as a reference."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="size-3.5" /> New contact
          </Button>
        }
      />

      <div className="mb-4">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="references">References</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? <Skeleton className="h-96" /> : null}
      {error ? (
        <ResourceError label="contacts" error={error} onRetry={refetch} />
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          headline={
            filter === "references" ? "No references yet" : "No contacts yet"
          }
          body={
            filter === "references"
              ? "Mark a contact as a reference to track who can vouch for you."
              : "Add recruiters, hiring managers, and people who can refer or vouch for you."
          }
          cta={{ label: "New contact", onClick: openCreate }}
        />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((c) => (
            <Card key={c.id} className="flex flex-col gap-2 p-[18px]">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{c.name}</span>
                    {c.isReference ? (
                      <Badge variant="accent">Reference</Badge>
                    ) : null}
                  </div>
                  <div className="text-[12.5px] text-[var(--fg-muted)]">
                    {c.role}
                    {c.org ? ` - ${c.org}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${c.name}`}
                  className="ml-auto text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                  onClick={() => remove(c)}
                  disabled={isMutating}
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
              {c.relationship ? (
                <div className="text-[12px] text-[var(--fg-muted)]">
                  {c.relationship}
                </div>
              ) : null}
              {c.notes ? <p className="m-0 text-[12.5px]">{c.notes}</p> : null}
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                  Edit
                </Button>
                {c.email ? (
                  <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
                    {c.email}
                  </span>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit contact" : "New contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <FormField label="Name" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Role">
                <Input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </FormField>
              <FormField label="Organization">
                <Input
                  value={form.org}
                  onChange={(e) => setForm({ ...form, org: e.target.value })}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField label="Relationship">
                <Input
                  value={form.relationship}
                  onChange={(e) =>
                    setForm({ ...form, relationship: e.target.value })
                  }
                  placeholder="Former manager"
                />
              </FormField>
            </div>
            <FormField label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </FormField>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.isReference}
                onChange={(e) =>
                  setForm({ ...form, isReference: e.target.checked })
                }
              />
              This contact is a reference
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isMutating}>
              {editing ? "Save" : "Add contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
