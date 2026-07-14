"""Seed demo data for local/staging environments.

Run as ``python -m app.scripts.seed [--reset] [--force]``. Seeds exactly one
demo user carrying the REMY persona profile (ported verbatim from
``app/store.py``'s ``_seed_current_user`` -- see that module for provenance),
plus the seven demo job postings (sprint-02) and the demo shortlist entries
(sprint-03) under that user: same fixed
UUIDs as ``store.jobs`` so mock inbox links resolve against the DB-backed
``getJob``. Job seeding UPSERTS the rows with those fixed ids IN PLACE (demo
fixtures are owned by the seed, but children may composite-FK them -- LC-1);
other jobs -- including ones a demo user captured through the UI -- are left
alone unless ``--reset`` wipes the demo user wholesale.

Safety (PIN-8, docs/sprints/sprint-01-spec.md): refuses to run outside
``ENVIRONMENT=local`` unless ``--force`` is passed, and that check happens
before any DB session is opened.
"""

import argparse
import logging
import sys
from collections.abc import Sequence

from sqlalchemy import text as sa_text
from sqlmodel import Session, col, delete, select

from app import crud, store
from app.core.config import settings
from app.core.db import engine
from app.core.security import get_password_hash
from app.job_mapper import wire_job_to_row
from app.models import Application, Job, Resume, ShortlistEntry, User, UserCreate
from app.resume_mapper import wire_resume_to_row
from app.schemas import Stage
from app.shortlist_mapper import wire_shortlist_to_row
from app.stage_flow import call_stage_transition

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ported verbatim from app/store.py::_seed_current_user (the REMY persona).
DEMO_FULL_NAME = "Wes Gilleland"
DEMO_INITIALS = "WG"
DEMO_CITY = "Lexington, KY"
DEMO_CURRENT = "Founder & Principal Engineer - Infinite Room Labs"
DEMO_YEARS = 12.0
DEMO_COMP_FLOOR = 210000.0
DEMO_TARGET_TITLES = [
    "Staff Engineer",
    "Senior Staff Engineer",
    "Principal Engineer",
    "Platform Lead",
]


def _demo_user_create() -> UserCreate:
    return UserCreate(
        email=settings.SEED_DEMO_EMAIL,
        password=settings.SEED_DEMO_PASSWORD,
        is_active=True,
        is_superuser=False,
        full_name=DEMO_FULL_NAME,
        initials=DEMO_INITIALS,
        city=DEMO_CITY,
        current=DEMO_CURRENT,
        years=DEMO_YEARS,
        comp_floor=DEMO_COMP_FLOOR,
        target_titles=list(DEMO_TARGET_TITLES),
    )


def seed_demo_jobs(session: Session, user: User) -> int:
    """Persist the seven demo postings under ``user`` (idempotent, in place).

    UPSERT-IN-PLACE, not delete+recreate (LC-1, sprint-04 3c): once anything
    composite-FKs a demo job -- a shortlist entry from a prior seed run, or a
    user shortlisting a demo posting through the UI -- deleting the job row
    violates ``fk_shortlist_job``/``fk_application_job``, which crashed every
    plain re-seed (incl. prestart on container restart) after the first.
    Existing rows are refreshed field-by-field so referencing children keep a
    stable target; missing rows are inserted. Runs as the migration/owner
    role on purpose: seeding is bootstrap, not tenant traffic, and the
    superuser bypasses RLS by definition.
    """
    seeds = store.demo_job_seeds()
    existing = {
        row.id: row
        for row in session.exec(select(Job).where(col(Job.id).in_(list(seeds)))).all()
    }
    for jid, wire_job in seeds.items():
        fresh = wire_job_to_row(wire_job, user_id=user.id)
        current = existing.get(jid)
        if current is None:
            session.add(fresh)
            continue
        for field, value in fresh.model_dump(exclude={"id"}).items():
            setattr(current, field, value)
        session.add(current)
    session.commit()
    return len(seeds)


def seed_demo_shortlist(session: Session, user: User) -> int:
    """Persist the demo shortlist entries under ``user`` (idempotent, replacing).

    MUST run after ``seed_demo_jobs``: entries with a ``jobId`` composite-FK
    the demo user's job rows (entries without a jobId are display-only). Keyed
    by the fixed entry ids so a re-seed replaces cleanly.
    """
    seeds = store.demo_shortlist_seeds()
    session.connection().execute(
        delete(ShortlistEntry).where(col(ShortlistEntry.id).in_([e.id for e in seeds]))
    )
    for entry in seeds:
        session.add(wire_shortlist_to_row(entry, user_id=user.id))
    session.commit()
    return len(seeds)


def seed_demo_resumes(session: Session, user: User) -> int:
    """Persist the minimal demo resume set under ``user`` (sprint-04 3c,
    PIN-15): the DEFAULT resume every seeded fixture application's
    applied-hop snapshot locks, plus two non-default variants.

    UPSERT-SKIP, not replace (deviation from ``seed_demo_jobs``/
    ``seed_demo_shortlist``): once ``seed_demo_applications`` below has run,
    ``resume_snapshot`` rows composite-FK (NO ACTION) onto these resume ids,
    so a delete+recreate would constraint-violate on any later non-reset
    run. Missing ids are inserted; already-present ones are left untouched
    (their ``used_in`` counter reflects real seeded history by then).
    """
    seeds = store.demo_resume_seeds()
    existing = set(
        session.exec(select(Resume.id).where(col(Resume.id).in_(list(seeds)))).all()
    )
    created = 0
    for rid, wire_resume in seeds.items():
        if rid in existing:
            continue
        session.add(wire_resume_to_row(wire_resume, user_id=user.id))
        created += 1
    session.commit()
    return created


# Canonical forward-only hop sequence from DRAFTING to each reachable final
# stage the seven fixture applications land on (LEGAL_TRANSITIONS-legal
# single edges, applications.py). Every hop before the last is a real
# intermediate stage the application legally passed through, mirroring how
# a live application would have arrived at its seeded final stage.
_CANONICAL_HOPS: dict[Stage, tuple[Stage, ...]] = {
    Stage.applied: (Stage.applied,),
    Stage.screening: (Stage.applied, Stage.screening),
    Stage.interview: (Stage.applied, Stage.screening, Stage.interview),
    Stage.offer: (Stage.applied, Stage.screening, Stage.interview, Stage.offer),
}


def seed_demo_applications(session: Session, user: User) -> int:
    """Persist the seven slug-keyed fixture applications as REAL DB rows
    under ``user`` (sprint-04 3c, PIN-15): interviews.py/match.py's mock
    cross-refs key by these exact ids (``store.APP_UUID_BY_SLUG``), so a
    DB-served getApplication/getApplicationTimeline must resolve them too.

    MUST run after ``seed_demo_resumes`` (the applied hop below composite-FKs
    the DEFAULT resume). Each fixture gets its own job row (the fixture's own
    job id -- distinct from the demo job-inbox postings ``seed_demo_jobs``
    writes) and a canonical-path ``stage_transition`` history walked through
    the ONE mutation function (owner call, GUC set to this tenant): DRAFTING
    -> APPLIED -> ... -> its seeded final stage, ``source='user'``. The
    APPLIED hop always locks the DEFAULT resume (``RESUME_ID_DISTRIBUTED`` --
    PIN-15: "resume_id = the DEFAULT resume", not each fixture's original
    mock resume label), producing the resume_snapshot + used_in bump PIN-2
    requires -- every row past drafting owns a real snapshot, no on-the-fly
    synthesis for seeded fixtures.

    UPSERT-SKIP, ALL-OR-NOTHING (deviation from ``seed_demo_jobs``): unlike
    plain job rows, ``stage_transition``/``resume_snapshot`` are append-only
    even for the owner (PIN-11), so an already-seeded fixture application
    cannot be cheaply replaced -- only ``--reset`` (which wipes the whole
    demo user first) re-runs this from empty. If ANY of the seven ids
    already exist, the whole function is a no-op: their job/history graphs
    are only ever built together in one pass.
    """
    pairs = store.demo_application_seeds()
    ids = [app.id for app, _job in pairs]
    existing = set(
        session.exec(select(Application.id).where(col(Application.id).in_(ids))).all()
    )
    if existing:
        return 0

    session.connection().execute(
        sa_text("SELECT set_config('app.user_id', :uid, true)"),
        {"uid": str(user.id)},
    )
    for app_wire, job_wire in pairs:
        job_row = wire_job_to_row(job_wire, user_id=user.id)
        session.add(job_row)
        # The composite fk_application_job FK needs the job row to exist
        # before the application row (which references it) is staged (same
        # ordering trap as createApplication's job-then-application flush).
        session.flush()

        app_row = Application(
            id=app_wire.id,
            user_id=user.id,
            job_id=job_wire.id,
            stage=Stage.drafting.value,
            version=1,
            created_at=app_wire.createdAt,
            flag=app_wire.flag.value if app_wire.flag else None,
            contact=app_wire.contact,
            coach_nudge=app_wire.coachNudge,
            resurrected=app_wire.resurrected,
            search_id=app_wire.searchId,
        )
        session.add(app_row)
        session.flush()

        prior = Stage.drafting
        version = 1
        for hop in _CANONICAL_HOPS[app_wire.stage]:
            resume_id = store.RESUME_ID_DISTRIBUTED if hop == Stage.applied else None
            call_stage_transition(
                session,
                app_id=app_wire.id,
                target=hop.value,
                allowed_from=[prior.value],
                expected_version=version,
                source="user",
                resume_id=resume_id,
                error_paths={},
            )
            version += 1
            prior = hop
    session.commit()
    return len(pairs)


def seed_demo_user(session: Session, *, reset: bool = False) -> User:
    """Create or refresh the demo user. Idempotent: always leaves exactly one.

    With ``reset=True``, the existing row is deleted first; its jobs go with
    it via the ``ON DELETE CASCADE`` on ``job.user_id`` (SIM-2).
    """
    existing = session.exec(
        select(User).where(User.email == settings.SEED_DEMO_EMAIL)
    ).first()

    if reset and existing is not None:
        # PIN-11: histories are append-only even for the owner; the teardown
        # helper disables the guards around one cascading DELETE.
        crud.delete_user_with_history(session=session, user_id=existing.id)
        session.commit()
        existing = None

    if existing is None:
        return crud.create_user(session=session, user_create=_demo_user_create())

    existing.is_active = True
    existing.is_superuser = False
    existing.full_name = DEMO_FULL_NAME
    existing.initials = DEMO_INITIALS
    existing.city = DEMO_CITY
    existing.current = DEMO_CURRENT
    existing.years = DEMO_YEARS
    existing.comp_floor = DEMO_COMP_FLOOR
    existing.target_titles = list(DEMO_TARGET_TITLES)
    existing.hashed_password = get_password_hash(settings.SEED_DEMO_PASSWORD)
    session.add(existing)
    session.commit()
    session.refresh(existing)
    return existing


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.scripts.seed",
        description="Seed the demo user (REMY persona) for local/staging use.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the existing demo user before re-creating it.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow seeding outside ENVIRONMENT=local.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)

    if settings.ENVIRONMENT != "local":
        if not args.force:
            logger.error(
                "Refusing to seed demo data: ENVIRONMENT=%s (pass --force to override)",
                settings.ENVIRONMENT,
            )
            return 1
        if settings.SEED_DEMO_PASSWORD == "employa-demo-1":
            logger.error(
                "Refusing to seed the default demo password outside local:"
                " set SEED_DEMO_PASSWORD"
            )
            return 1

    logger.info("Seeding demo user (reset=%s)", args.reset)
    with Session(engine) as session:
        user = seed_demo_user(session, reset=args.reset)
        job_count = seed_demo_jobs(session, user)
        shortlist_count = seed_demo_shortlist(session, user)
        # Resumes MUST land before applications: the applied-hop transition
        # below composite-FKs the DEFAULT resume (RESUME_ID_DISTRIBUTED).
        resume_count = seed_demo_resumes(session, user)
        application_count = seed_demo_applications(session, user)
    logger.info(
        "Demo user seeded (with %d demo jobs, %d shortlist entries, "
        "%d resumes, %d applications)",
        job_count,
        shortlist_count,
        resume_count,
        application_count,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
