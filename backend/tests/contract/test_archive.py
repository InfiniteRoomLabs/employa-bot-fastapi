"""The archive resource (ORI-009) is fully DB-backed.

Since sprint-04 3a both ops previously covered here (getArchive,
getArchiveCounts) are DB-backed (docs/sprints/sprint-04-spec.md PIN-16) --
neither op has a mock-served remainder, so there is nothing left to test
DB-free here. Fidelity, bucket membership, and count coverage now lives in
``tests/api/routes/test_applications.py`` alongside the applications
fidelity suite (the archive read is an outcome-bucketed SELECT over the
same ``application`` table).
"""

from __future__ import annotations
