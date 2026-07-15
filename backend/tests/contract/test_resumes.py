"""The resume CRUD/lifecycle ops (RES-019 / CUR-020) are fully DB-backed.

Since sprint-04 3a all 8 ops previously covered here (getResumes,
createResume, getResume, patchResume, deleteResume, duplicateResume,
setDefaultResume, forkResumeAsDraft) are DB-backed (docs/sprints/
sprint-04-spec.md PIN-6) -- unlike getJobs/getShortlist, none of this
resource's ops stay mock, so there is no mock-served remainder to test here.
Fidelity, tenancy, provenance, and the resume-lock 409 taxonomy coverage now
lives in ``tests/api/routes/test_resumes.py``.

Full resume-lifecycle management (uploads/career-history/templates/exports/
projections) stays mock through Release 0.1 and is covered separately in
``tests/contract/test_resume_lifecycle.py``.
"""

from __future__ import annotations
