"""Fixture self-test (spec PIN-9): prove the rollback world is in effect.

Two properties, both asserted on DB state:

1. In-test ``session.commit()`` stays INVISIBLE to other connections -- the
   outer transaction really wraps the test.
2. Committed writes are GONE after teardown -- ``test_2`` observes that
   ``test_1``'s committed row does not survive (ordered within this module).
"""

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import get_password_hash
from app.models import User

_PROBE_EMAIL = "rollback-probe@example.com"


def _probe_row(session: Session) -> User | None:
    return session.exec(select(User).where(User.email == _PROBE_EMAIL)).first()


def test_1_committed_write_is_connection_local(db: Session) -> None:
    db.add(
        User(
            email=_PROBE_EMAIL,
            hashed_password=get_password_hash("irrelevant-1"),
        )
    )
    db.commit()

    assert _probe_row(db) is not None, "write must be visible to the test session"
    with Session(engine) as outside:
        assert _probe_row(outside) is None, (
            "committed write leaked outside the outer transaction -- "
            "the rollback fixture is not in effect"
        )


def test_2_committed_write_did_not_survive_teardown(db: Session) -> None:
    assert _probe_row(db) is None, (
        "previous test's committed row survived teardown -- "
        "the outer transaction was not rolled back"
    )
