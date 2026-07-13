"""runtime role and append-only machinery

Revision ID: 075675058c67
Revises: 3bae06a61157
Create Date: 2026-07-13 16:37:57.228084

Creates the tenancy/immutability machinery plan v3's Design conventions bind
from the first migration:

* ``app_runtime`` -- the non-superuser role the application runs as (NOLOGIN
  for now; tests exercise it via ``SET ROLE``, and the app's connection role
  is wired when the first DB vertical ships). It gets DML on everything by
  default; append-only tables then revoke UPDATE/DELETE/TRUNCATE from it.
* ``raise_append_only()`` -- trigger function, defense-in-depth layer.
* ``enforce_append_only(regclass)`` -- one call per append-only table
  (sprint-04: stage_transition, resume_snapshot). Primary protection is the
  REVOKE; the BEFORE UPDATE/DELETE row triggers and BEFORE TRUNCATE statement
  trigger catch owner/superuser paths too. Owner actions remain outside the
  guarantee (documented, not pretended away).

Downgrade raises: forward-fix-only policy (plan v3, Migrations).
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "075675058c67"
down_revision = "3bae06a61157"
branch_labels = None
depends_on = None


def upgrade():
    # Role is cluster-wide; guard for reruns against the same cluster
    # (scratch-DB migration tests, developer resets).
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
                CREATE ROLE app_runtime NOLOGIN;
            END IF;
        END
        $$;
        """
    )
    op.execute("GRANT USAGE ON SCHEMA public TO app_runtime")
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public"
        " TO app_runtime"
    )
    op.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_runtime")
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public"
        " GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public"
        " GRANT USAGE ON SEQUENCES TO app_runtime"
    )
    # The runtime role must not replay or edit migration history.
    op.execute("REVOKE ALL ON alembic_version FROM app_runtime")

    op.execute(
        """
        CREATE OR REPLACE FUNCTION raise_append_only() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'append-only table %: % is not permitted',
                TG_TABLE_NAME, TG_OP;
        END
        $$;
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION enforce_append_only(target regclass) RETURNS void
        LANGUAGE plpgsql AS $$
        BEGIN
            EXECUTE format(
                'REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM app_runtime', target);
            EXECUTE format(
                'CREATE TRIGGER append_only_guard '
                'BEFORE UPDATE OR DELETE ON %s '
                'FOR EACH ROW EXECUTE FUNCTION raise_append_only()', target);
            EXECUTE format(
                'CREATE TRIGGER append_only_truncate_guard '
                'BEFORE TRUNCATE ON %s '
                'EXECUTE FUNCTION raise_append_only()', target);
        END
        $$;
        """
    )


def downgrade():
    raise RuntimeError(
        "forward-fix only: this project does not support downgrades"
        " (plan v3, Migrations)"
    )
