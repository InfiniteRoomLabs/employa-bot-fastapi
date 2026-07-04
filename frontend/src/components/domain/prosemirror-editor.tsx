/**
 * ProseMirrorEditor (RES-022) -- an interactable rich-text surface for the
 * resume editor body. Mounts a ProseMirror `EditorView` into a ref'd div with
 * the basic schema + list nodes, history, and the standard keymaps, plus a
 * formatting toolbar (bold / italic / lists / heading / undo / redo) and the
 * Mod-b / Mod-i shortcuts. When `editable` is false (e.g. a resume locked on
 * APPLIED) the view renders read-only and the toolbar is hidden.
 *
 * Persistence: `onChange` serializes the full doc to HTML, so inline marks
 * (bold/italic) + block structure (headings/lists) round-trip. The resume editor
 * saves that HTML through the api mutable store (mockup; the real swap-seam is a
 * PATCH /resume/:id). Seed fixtures still hold plain text -- `docFromSource`
 * handles both (plain -> paragraphs, HTML -> parsed). State still resets on a
 * full page reload (no localStorage), which is documented mockup behavior.
 */

import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react"
import { baseKeymap, setBlockType, toggleMark } from "prosemirror-commands"
import { history, redo, undo } from "prosemirror-history"
import { keymap } from "prosemirror-keymap"
import {
  DOMSerializer,
  DOMParser as ProseMirrorDOMParser,
  type Node as ProseMirrorNode,
  Schema,
} from "prosemirror-model"
import { schema as basicSchema } from "prosemirror-schema-basic"
import { addListNodes, wrapInList } from "prosemirror-schema-list"
import { type Command, EditorState } from "prosemirror-state"
import { EditorView } from "prosemirror-view"
import * as React from "react"

// Basic schema extended with bullet/ordered lists -- enough for resume bullets.
const resumeSchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
  marks: basicSchema.spec.marks,
})

/** Build a doc from plain text: blank lines split paragraphs. */
function docFromText(text: string) {
  const container = document.createElement("div")
  const paragraphs = text.trim().length > 0 ? text.split(/\n{2,}/) : [""]
  for (const paragraph of paragraphs) {
    const element = document.createElement("p")
    element.textContent = paragraph.replace(/\n/g, " ")
    container.appendChild(element)
  }
  return ProseMirrorDOMParser.fromSchema(resumeSchema).parse(container)
}

/** True when the source looks like serialized HTML (a saved rich body) vs. plain text. */
function looksLikeHtml(source: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(source)
}

/**
 * Build the initial doc from `source`: parse it as HTML when it is a saved rich
 * body (round-tripping bold/italic/lists/headings), otherwise fall back to the
 * plain-text paragraph splitter (the shape the seed fixtures still use).
 */
function docFromSource(source: string): ProseMirrorNode {
  if (looksLikeHtml(source)) {
    // Safety: `container` is a DETACHED node (never inserted into the live DOM),
    // and innerHTML does not execute scripts. ProseMirror's DOMParser then reads
    // it into a CONSTRAINED schema (paragraph / heading / list + strong/em/code/
    // link only), dropping any disallowed tags/attributes, and renders via its
    // own DOM construction -- so this is not a live-DOM XSS sink. PRODUCTION
    // NOTE: when the real backend stores user-authored bodies, still sanitize on
    // write (e.g. DOMPurify) -- do not trust the stored string blindly.
    const container = document.createElement("div")
    container.innerHTML = source
    return ProseMirrorDOMParser.fromSchema(resumeSchema).parse(container)
  }
  return docFromText(source)
}

/** Serialize the doc to HTML so marks (bold/italic) + block structure persist. */
function docToHtml(doc: ProseMirrorNode): string {
  const fragment = DOMSerializer.fromSchema(resumeSchema).serializeFragment(
    doc.content,
  )
  const container = document.createElement("div")
  container.appendChild(fragment)
  return container.innerHTML
}

// Formatting commands the toolbar + shortcuts run against the resume schema.
const toggleBold = toggleMark(resumeSchema.marks.strong)
const toggleItalic = toggleMark(resumeSchema.marks.em)
const wrapBullets = wrapInList(resumeSchema.nodes.bullet_list)
const wrapOrdered = wrapInList(resumeSchema.nodes.ordered_list)
const setHeading = setBlockType(resumeSchema.nodes.heading, { level: 2 })

interface ToolButton {
  key: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  command: Command
}

const TOOL_BUTTONS: readonly ToolButton[] = [
  { key: "bold", label: "Bold", Icon: BoldIcon, command: toggleBold },
  { key: "italic", label: "Italic", Icon: ItalicIcon, command: toggleItalic },
  { key: "h2", label: "Heading", Icon: Heading2Icon, command: setHeading },
  { key: "bullet", label: "Bullet list", Icon: ListIcon, command: wrapBullets },
  {
    key: "ordered",
    label: "Numbered list",
    Icon: ListOrderedIcon,
    command: wrapOrdered,
  },
  { key: "undo", label: "Undo", Icon: Undo2Icon, command: undo },
  { key: "redo", label: "Redo", Icon: Redo2Icon, command: redo },
]

export interface ProseMirrorEditorProps {
  /** Initial content -- plain text (seed fixtures) or saved HTML. */
  initialText: string
  /** When false, the document renders read-only (e.g. locked resume). */
  editable?: boolean
  /** Notified with the doc serialized to HTML whenever it changes. */
  onChange?: (html: string) => void
  className?: string
}

export function ProseMirrorEditor({
  initialText,
  editable = true,
  onChange,
  className,
}: ProseMirrorEditorProps) {
  const mountRef = React.useRef<HTMLDivElement>(null)
  const viewRef = React.useRef<EditorView | null>(null)
  const onChangeRef = React.useRef(onChange)
  // Keep the latest onChange without re-mounting the editor (effect, not render).
  React.useEffect(() => {
    onChangeRef.current = onChange
  })

  React.useEffect(() => {
    const mount = mountRef.current
    if (!mount) {
      return
    }

    const view = new EditorView(mount, {
      state: EditorState.create({
        doc: docFromSource(initialText),
        plugins: [
          history(),
          keymap({
            "Mod-z": undo,
            "Mod-y": redo,
            "Mod-Shift-z": redo,
            "Mod-b": toggleBold,
            "Mod-i": toggleItalic,
          }),
          keymap(baseKeymap),
        ],
      }),
      editable: () => editable,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction)
        view.updateState(newState)
        if (transaction.docChanged) {
          onChangeRef.current?.(docToHtml(newState.doc))
        }
      },
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Re-mount only when the source content or editability changes.
  }, [initialText, editable])

  /** Run a ProseMirror command against the live view, keeping focus. */
  const run = (command: Command) => {
    const view = viewRef.current
    if (!view) {
      return
    }
    command(view.state, view.dispatch, view)
    view.focus()
  }

  return (
    <div>
      {editable ? (
        <div
          className="mb-3 flex items-center gap-1 rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)] p-1"
          role="toolbar"
          aria-label="Formatting"
        >
          {TOOL_BUTTONS.map((tool) => (
            <button
              key={tool.key}
              type="button"
              aria-label={tool.label}
              title={tool.label}
              className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
              // preventDefault keeps the editor selection so the command applies to it.
              onMouseDown={(event) => {
                event.preventDefault()
                run(tool.command)
              }}
            >
              <tool.Icon className="size-3.5" />
            </button>
          ))}
        </div>
      ) : null}
      <div
        ref={mountRef}
        data-slot="prosemirror-editor"
        className={className}
        aria-label="Resume editor"
      />
    </div>
  )
}
