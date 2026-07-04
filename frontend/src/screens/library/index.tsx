/**
 * Library Overview (LIB-001/002). One at-a-glance home for every artifact type
 * the user maintains. Each card shows a live count + routes to that type's
 * surface. The sidebar also links each type directly (LIB-001), so this Overview
 * is intentionally a convenience hub, not the only entry point.
 */

import {
  AwardIcon,
  BadgeCheckIcon,
  FileTextIcon,
  FolderGit2Icon,
  LayoutTemplateIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  UsersIcon,
} from "lucide-react"
import { Link } from "react-router-dom"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Card } from "@/components/ui/card-eb"
import {
  useAccomplishments,
  useAnswers,
  useContacts,
  useCredentials,
  useProjects,
  useResumes,
  useResumeTemplates,
} from "@/hooks"
import { pathFor } from "@/routes"

interface LibraryTile {
  routeId: string
  label: string
  icon: LucideIcon
  count: number | undefined
  blurb: string
}

export default function LibraryScreen() {
  const resumes = useResumes()
  const contacts = useContacts()
  const accomplishments = useAccomplishments()
  const answers = useAnswers()
  const projects = useProjects()
  const credentials = useCredentials()
  const templates = useResumeTemplates()

  const tiles: readonly LibraryTile[] = [
    {
      routeId: "resumes",
      label: "Resumes",
      icon: FileTextIcon,
      count: resumes.data?.length,
      blurb: "Uploads, masters, and exports across the resume lifecycle.",
    },
    {
      routeId: "contacts",
      label: "Contacts",
      icon: UsersIcon,
      count: contacts.data?.length,
      blurb: "Recruiters, hiring managers, and references.",
    },
    {
      routeId: "accomplishments",
      label: "Accomplishments",
      icon: AwardIcon,
      count: accomplishments.data?.length,
      blurb: "Reusable quantified wins and STAR stories.",
    },
    {
      routeId: "answers",
      label: "Answers",
      icon: MessageCircleQuestionIcon,
      count: answers.data?.length,
      blurb: "Saved responses to recurring application questions.",
    },
    {
      routeId: "projects",
      label: "Projects",
      icon: FolderGit2Icon,
      count: projects.data?.length,
      blurb: "Per-employer brain-dumps that feed resumes and answers.",
    },
    {
      routeId: "credentials",
      label: "Credentials",
      icon: BadgeCheckIcon,
      count: credentials.data?.length,
      blurb: "Licenses, certifications, and documents.",
    },
    {
      routeId: "templates",
      label: "Templates",
      icon: LayoutTemplateIcon,
      count: templates.data?.length,
      blurb: "Layouts your resumes render through.",
    },
  ]

  return (
    <AppFrame
      active="library"
      title="Library"
      subtitle="Everything you own and reuse"
    >
      <PageHead
        eyebrow="Library"
        title="Your library"
        lede="Reusable material you pull from across every application -- resumes, contacts, accomplishments, answers, projects, credentials, and templates."
      />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.routeId}
              to={pathFor(tile.routeId)}
              className="block"
            >
              <Card className="flex h-full flex-col gap-2 p-[18px] transition-colors hover:bg-[var(--bg-subtle)]">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-[var(--fg-muted)]" aria-hidden />
                  <span className="text-[15px] font-semibold">
                    {tile.label}
                  </span>
                  <span className="nav-count ml-auto">{tile.count ?? "-"}</span>
                </div>
                <p className="m-0 text-[12.5px] text-[var(--fg-muted)]">
                  {tile.blurb}
                </p>
              </Card>
            </Link>
          )
        })}
      </div>
    </AppFrame>
  )
}
