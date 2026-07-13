"""Seed a demo user for local/staging environments.

Run as ``python -m app.scripts.seed [--reset] [--force]``. Seeds exactly one
demo user carrying the REMY persona profile (ported verbatim from
``app/store.py``'s ``_seed_current_user`` -- see that module for provenance).

Safety (PIN-8, docs/sprints/sprint-01-spec.md): refuses to run outside
``ENVIRONMENT=local`` unless ``--force`` is passed, and that check happens
before any DB session is opened.
"""

import argparse
import logging
import sys
from collections.abc import Sequence

from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.core.security import get_password_hash
from app.models import User, UserCreate

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


def seed_demo_user(session: Session, *, reset: bool = False) -> User:
    """Create or refresh the demo user. Idempotent: always leaves exactly one.

    With ``reset=True``, the existing row is deleted first (later sprints
    extend this to demo entities beyond the user).
    """
    existing = session.exec(
        select(User).where(User.email == settings.SEED_DEMO_EMAIL)
    ).first()

    if reset and existing is not None:
        session.delete(existing)
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
        seed_demo_user(session, reset=args.reset)
    logger.info("Demo user seeded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
