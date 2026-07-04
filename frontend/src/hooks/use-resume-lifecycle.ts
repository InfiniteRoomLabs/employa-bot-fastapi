import * as api from "../data/api"
import type {
  CareerHistoryItem,
  Resume,
  ResumeExport,
  ResumeTemplate,
  ResumeUpload,
} from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** RES-030: immutable uploaded originals. */
export function useResumeUploads(): HookState<readonly ResumeUpload[]> {
  return useAsyncResource(() => api.getResumeUploads(), [])
}

/** RES-031: the parsed career history (UI label: "career history"). */
export function useCareerHistory(): HookState<readonly CareerHistoryItem[]> {
  return useAsyncResource(() => api.getCareerHistory(), [])
}

/** RES-034: master/variant projections over career history. */
export function useProjections(): HookState<readonly Resume[]> {
  return useAsyncResource(() => api.getProjections(), [])
}

/** RES-037: rendered, regenerable exports. */
export function useResumeExports(): HookState<readonly ResumeExport[]> {
  return useAsyncResource(() => api.getResumeExports(), [])
}

/** TPL-001: available resume layout templates. */
export function useResumeTemplates(): HookState<readonly ResumeTemplate[]> {
  return useAsyncResource(() => api.getResumeTemplates(), [])
}
