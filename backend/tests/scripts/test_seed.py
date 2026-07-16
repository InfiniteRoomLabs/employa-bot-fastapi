"""Seed-module tests.

Seed is BOOTSTRAP-tier (like prestart): it writes real, committed rows with
its own engine sessions. It deliberately does NOT use the ``db`` rollback
fixture -- ``main()`` opens its own session, and mixing the two worlds
deadlocks on the demo user's unique email (an uncommitted row in the test's
outer transaction blocks the script's INSERT). Cleanup is explicit instead.
"""

from collections.abc import Generator

import pytest
from sqlmodel import Session, col, delete, select

from app import crud, store
from app.core.config import settings
from app.core.db import engine
from app.core.security import verify_password
from app.models import Job, User
from app.scripts.seed import (
    DEMO_CITY,
    DEMO_COMP_FLOOR,
    DEMO_CURRENT,
    DEMO_FULL_NAME,
    DEMO_INITIALS,
    DEMO_TARGET_TITLES,
    DEMO_YEARS,
    main,
    seed_demo_user,
)


def _delete_demo_user() -> None:
    with Session(engine) as session:
        demo = session.exec(
            select(User).where(User.email == settings.SEED_DEMO_EMAIL)
        ).first()
        if demo is not None:
            # PIN-11: the teardown helper handles the append-only children a
            # plain ORM delete cannot (job/shortlist still cascade as before).
            crud.delete_user_with_history(session=session, user_id=demo.id)
        session.commit()


@pytest.fixture()
def clean_demo_slate() -> Generator[None]:
    """No demo user before the test; none left behind after."""
    _delete_demo_user()
    yield
    _delete_demo_user()


def _get_demo_users() -> list[User]:
    with Session(engine) as session:
        users = session.exec(
            select(User).where(User.email == settings.SEED_DEMO_EMAIL)
        ).all()
        session.expunge_all()
        return list(users)


def _assert_persona(user: User) -> None:
    assert user.email == settings.SEED_DEMO_EMAIL
    assert user.full_name == DEMO_FULL_NAME
    assert user.initials == DEMO_INITIALS
    assert user.city == DEMO_CITY
    assert user.current == DEMO_CURRENT
    assert user.years == DEMO_YEARS
    assert user.comp_floor == DEMO_COMP_FLOOR
    assert user.target_titles == DEMO_TARGET_TITLES
    assert user.is_active is True
    assert user.is_superuser is False


@pytest.mark.usefixtures("clean_demo_slate")
def test_seed_demo_user_twice_is_idempotent() -> None:
    with Session(engine) as session:
        seed_demo_user(session)
        seed_demo_user(session)

    users = _get_demo_users()
    assert len(users) == 1
    _assert_persona(users[0])


@pytest.mark.usefixtures("clean_demo_slate")
def test_seed_reset_leaves_other_users_untouched() -> None:
    """P6 verifier finding: a widened delete scope must not survive review."""
    bystander_email = "bystander-probe@example.com"
    with Session(engine) as session:
        session.execute(
            delete(User).where(User.email == bystander_email)  # type: ignore[arg-type]
        )
        bystander = User(
            email=bystander_email,
            hashed_password="untouched-hash",
            full_name="By Stander",
        )
        session.add(bystander)
        session.commit()

    try:
        with Session(engine) as session:
            seed_demo_user(session, reset=True)
        with Session(engine) as session:
            survivor = session.exec(
                select(User).where(User.email == bystander_email)
            ).one()
            assert survivor.hashed_password == "untouched-hash"
            assert survivor.full_name == "By Stander"
    finally:
        with Session(engine) as session:
            session.execute(
                delete(User).where(User.email == bystander_email)  # type: ignore[arg-type]
            )
            session.commit()


@pytest.mark.usefixtures("clean_demo_slate")
def test_plain_reseed_after_full_seed_is_green() -> None:
    """LC-1 regression (sprint-04 3c): seed_demo_jobs' old delete+recreate
    crashed EVERY plain re-seed (incl. prestart on container restart) with a
    ForeignKeyViolation once shortlist entries composite-FK'd the demo jobs.
    Upsert-in-place must make a second full run green with stable job ids."""
    assert main([]) == 0
    with Session(engine) as session:
        job_ids_first = set(
            session.exec(
                select(Job.id).where(col(Job.id).in_(list(store.demo_job_seeds())))
            ).all()
        )
    assert main([]) == 0  # crashed before the LC-1 fix
    users = _get_demo_users()
    assert len(users) == 1
    with Session(engine) as session:
        job_ids_second = set(
            session.exec(
                select(Job.id).where(col(Job.id).in_(list(store.demo_job_seeds())))
            ).all()
        )
    assert job_ids_second == job_ids_first  # rows refreshed IN PLACE


@pytest.mark.usefixtures("clean_demo_slate")
def test_seed_reset_recreates_login_capable_user() -> None:
    assert main([]) == 0
    first = _get_demo_users()
    assert len(first) == 1
    first_id = first[0].id

    assert main(["--reset"]) == 0

    recreated = _get_demo_users()
    assert len(recreated) == 1
    assert recreated[0].id != first_id
    _assert_persona(recreated[0])

    verified, _ = verify_password(
        settings.SEED_DEMO_PASSWORD, recreated[0].hashed_password
    )
    assert verified


@pytest.mark.usefixtures("clean_demo_slate")
def test_seed_materializes_canonical_match_report() -> None:
    """Sprint-05 PIN-A13: the canonical pair gets a function-walked settled
    run with the FIXTURE payload (score 92, headroom 16.58 -- mock parity),
    and a plain re-seed neither duplicates the graph nor moves the budget."""
    from decimal import Decimal

    from app.models import AiRun, MatchReport, UserAiBudget

    assert main([]) == 0
    demo = _get_demo_users()[0]
    with Session(engine) as session:
        report = session.exec(
            select(MatchReport)
            .where(MatchReport.user_id == demo.id)
            .where(MatchReport.job_id == store.JOB_ID_STRIPE)
            .where(MatchReport.resume_id == store.RESUME_ID_DISTRIBUTED)
        ).one()
        assert report.score == store.MATCH_REPORT_SCORE  # 92, NOT the fake 95
        assert report.version == 1
        assert len(report.rubric) == 4
        budget = session.exec(
            select(UserAiBudget).where(UserAiBudget.user_id == demo.id)
        ).one()
        assert budget.spent_usd == Decimal("3.42")  # 3.28 baseline + 0.14 run
        assert budget.reserved_usd == Decimal("0")

    assert main([]) == 0  # plain re-seed: all-or-nothing skip
    with Session(engine) as session:
        runs = session.exec(
            select(AiRun).where(AiRun.user_id == demo.id)
        ).all()
        assert len(runs) == 1
        budget = session.exec(
            select(UserAiBudget).where(UserAiBudget.user_id == demo.id)
        ).one()
        assert budget.spent_usd == Decimal("3.42")
