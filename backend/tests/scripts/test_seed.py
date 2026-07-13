"""Seed-module tests.

Seed is BOOTSTRAP-tier (like prestart): it writes real, committed rows with
its own engine sessions. It deliberately does NOT use the ``db`` rollback
fixture -- ``main()`` opens its own session, and mixing the two worlds
deadlocks on the demo user's unique email (an uncommitted row in the test's
outer transaction blocks the script's INSERT). Cleanup is explicit instead.
"""

from collections.abc import Generator

import pytest
from sqlmodel import Session, delete, select

from app.core.config import settings
from app.core.db import engine
from app.core.security import verify_password
from app.models import User
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
        session.execute(
            delete(User).where(User.email == settings.SEED_DEMO_EMAIL)  # type: ignore[arg-type]
        )
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
