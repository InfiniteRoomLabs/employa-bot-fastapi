"""Wire <-> row mapping for the match-report vertical (sprint-05).

``schemas.MatchReport`` is the frozen contract shape; ``models.MatchReport``
is the append-only version row. ``version``/``ai_run_id``/``created_at`` are
row-only columns with NO wire field (the wire shape has no version concept;
the CURRENT version is selected DB-side, PIN-A7), so ``row_to_wire`` never
emits them.

``row_to_wire_match_report`` funnels through
``schemas.MatchReport.model_validate`` so any row the DB can hold that the
wire cannot express fails loudly (the runtime drift guard).
"""

from __future__ import annotations

from typing import Any

from app import schemas
from app.models import MatchReport as MatchReportRow


def row_to_wire_match_report(row: MatchReportRow) -> schemas.MatchReport:
    payload: dict[str, Any] = {
        "resumeId": row.resume_id,
        "jobId": row.job_id,
        "score": row.score,
        "rubric": row.rubric,
        "gaps": row.gaps,
        "strengths": row.strengths,
    }
    return schemas.MatchReport.model_validate(payload)
