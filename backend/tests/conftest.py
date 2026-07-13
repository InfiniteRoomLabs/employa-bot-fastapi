"""The one DB test world (plan v3, Test isolation).

Every DB test runs inside an OUTER transaction on a dedicated connection,
rolled back at teardown -- never truncate, never delete-all. Application
``session.commit()`` calls are absorbed by savepoint restart
(``join_transaction_mode="create_savepoint"``), so committed-looking writes
stay invisible to other connections and vanish at rollback
(``tests/test_db_world.py`` proves both properties).

There is NO autouse fixture here: tests that want the database request ``db``
(or a client fixture) explicitly, and DB-free suites (``tests/contract``)
simply never pull the chain. Session-scoped ``seed_domain`` is the bootstrap
tier -- the state prestart+seed would leave behind (FIRST_SUPERUSER, the test
user, the intruder user), committed for real, once.

Auth headers are minted directly via ``security.create_access_token`` instead
of HTTP logins so the suite never races the login throttle; the login flow
itself is covered by ``tests/api/routes/test_login.py``.
"""

from collections.abc import Generator
from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api import deps
from app.core import security, throttle
from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from app.models import User, UserCreate
from tests.utils.utils import random_email, random_lower_string


@dataclass(frozen=True)
class SeededUsers:
    superuser: User
    test_user: User
    intruder: User


@pytest.fixture(scope="session")
def seed_domain() -> SeededUsers:
    """Bootstrap-tier rows, committed for real (the prestart/seed analogue)."""
    from app import crud

    with Session(engine) as session:
        init_db(session)
        superuser = crud.get_user_by_email(
            session=session, email=settings.FIRST_SUPERUSER
        )
        assert superuser is not None
        test_user = crud.get_user_by_email(
            session=session, email=settings.EMAIL_TEST_USER
        )
        if test_user is None:
            test_user = crud.create_user(
                session=session,
                user_create=UserCreate(
                    email=settings.EMAIL_TEST_USER, password=random_lower_string()
                ),
            )
        intruder = crud.get_user_by_email(session=session, email="intruder@example.com")
        if intruder is None:
            intruder = crud.create_user(
                session=session,
                user_create=UserCreate(
                    email="intruder@example.com", password=random_lower_string()
                ),
            )
        # Detach fully-loaded copies so tests can read attributes after close.
        session.refresh(superuser)
        session.refresh(test_user)
        session.refresh(intruder)
        session.expunge_all()
        return SeededUsers(superuser=superuser, test_user=test_user, intruder=intruder)


@pytest.fixture()
def db() -> Generator[Session]:
    """Outer-transaction session; everything a test writes is rolled back.

    Session-scoped ``seed_domain`` always instantiates before this
    function-scoped fixture (pytest scope ordering), so bootstrap commits
    never interleave with an open outer transaction.
    """
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture()
def client(db: Session) -> Generator[TestClient]:
    """App client whose requests share the test's rollback session.

    The login throttle is dropped per test so suites doing real logins never
    inherit another test's window (the throttle itself is tested explicitly
    in tests/api/routes/test_auth_conventions.py).
    """
    throttle.reset()
    app.dependency_overrides[deps.get_db] = lambda: db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(deps.get_db, None)


def _bearer_for(user: User) -> dict[str, str]:
    token = security.create_access_token(
        user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        session_version=user.session_version,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def superuser_token_headers(seed_domain: SeededUsers) -> dict[str, str]:
    return _bearer_for(seed_domain.superuser)


@pytest.fixture()
def normal_user_token_headers(seed_domain: SeededUsers) -> dict[str, str]:
    return _bearer_for(seed_domain.test_user)


@pytest.fixture()
def db_client(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> TestClient:
    """Client authenticated as the seeded normal user."""
    client.headers.update(normal_user_token_headers)
    return client


@pytest.fixture()
def intruder_client(client: TestClient, seed_domain: SeededUsers) -> TestClient:
    """A SECOND authenticated identity, for tenancy assertions."""
    client.headers.update(_bearer_for(seed_domain.intruder))
    return client


# Convenience export for tests that need a random user in-transaction.
__all__ = ["SeededUsers", "random_email"]
