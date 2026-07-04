/**
 * Public hook surface. Components consume the mock-API exclusively through
 * these hooks -- replacing them is the future Symfony + API Platform consumer's
 * job. The `_use-async-resource` helper is intentionally NOT re-exported here.
 */

export type { HookState } from "./_use-async-resource"
export { useAccomplishments } from "./use-accomplishments"
export { useAddJobToShortlist } from "./use-add-job-to-shortlist"
export { useAgent } from "./use-agent"
export { useAgentLog } from "./use-agent-log"
export type { UseAgentMutationsResult } from "./use-agent-mutations"
export { useAgentMutations } from "./use-agent-mutations"
export { useAgentPermissions } from "./use-agent-permissions"
export { useAgentTrustTier } from "./use-agent-trust-tier"
export { useAgents } from "./use-agents"
export { useAnswers } from "./use-answers"
export { useApplication } from "./use-application"
export type { UseApplicationLifecycleResult } from "./use-application-lifecycle"
export { useApplicationLifecycle } from "./use-application-lifecycle"
export { useApplicationTimeline } from "./use-application-timeline"
export { useApplications } from "./use-applications"
export { useApplyToJob } from "./use-apply-to-job"
export { useArchive, useArchiveCounts } from "./use-archive"
export { useBudgetSummary } from "./use-budget-summary"
export { useCoachGreeting } from "./use-coach-greeting"
export {
  type UseCoachProposalResult,
  useCoachProposal,
} from "./use-coach-proposal"
export { type CoachThreadBundle, useCoachThread } from "./use-coach-thread"
export { useCoachThreads } from "./use-coach-threads"
export { useContacts } from "./use-contacts"
export { useCreateApplication } from "./use-create-application"
export { useCreateSearch } from "./use-create-search"
export { useCredentials } from "./use-credentials"
export { useCurrentUser } from "./use-current-user"
export type { UseDataExportResult } from "./use-data-export"
export { useDataExport } from "./use-data-export"
export type { UseDeepMatchScoreResult } from "./use-deep-match-score"
export { useDeepMatchScore } from "./use-deep-match-score"
export type { UseDeleteAccountResult } from "./use-delete-account"
export { useDeleteAccount } from "./use-delete-account"
export {
  type ExtensionStateBundle,
  useExtensionState,
} from "./use-extension-state"
export type { InterviewRoundPatch } from "./use-interview-mutations"
export { useInterviewMutations } from "./use-interview-mutations"
export { useInterviewRounds } from "./use-interview-rounds"
export { useJob, useJobs } from "./use-job"
export { useJobsInbox } from "./use-jobs-inbox"
export {
  type UseLibraryMutationsResult,
  useLibraryMutations,
} from "./use-library-mutations"
export type { UseLibraryTrashMutationsResult } from "./use-library-trash"
export {
  useDeletionImpact,
  useLibraryTrashMutations,
  useTrash,
} from "./use-library-trash"
export { useMatchReport } from "./use-match-report"
export {
  type UseNotificationsResult,
  useNotifications,
} from "./use-notifications"
export { useProjects } from "./use-projects"
export { useResume } from "./use-resume"
export { useResumeById } from "./use-resume-by-id"
export {
  useCareerHistory,
  useProjections,
  useResumeExports,
  useResumeTemplates,
  useResumeUploads,
} from "./use-resume-lifecycle"
export {
  type UseResumeLifecycleMutationsResult,
  useResumeLifecycleMutations,
} from "./use-resume-lifecycle-mutations"
export type { UseResumeMutationsResult } from "./use-resume-mutations"
export { useResumeMutations } from "./use-resume-mutations"
export type { UseResumeScoringResult } from "./use-resume-scoring"
export { useResumeScoring } from "./use-resume-scoring"
export { useResumeSnapshot } from "./use-resume-snapshot"
export { useResumes } from "./use-resumes"
export type { UseReviewQueueResult } from "./use-review-queue"
export { useReviewQueue } from "./use-review-queue"
export { useSearch } from "./use-search"
export { useSearches } from "./use-searches"
export { useSettings } from "./use-settings"
export { useShortlist } from "./use-shortlist"
export type { UseShortlistMutationsResult } from "./use-shortlist-mutations"
export { useShortlistMutations } from "./use-shortlist-mutations"
export { useUpdateSearchCriteria } from "./use-update-search-criteria"
export { useUsageAggregate } from "./use-usage-aggregate"
export { useUserMenu } from "./use-user-menu"
