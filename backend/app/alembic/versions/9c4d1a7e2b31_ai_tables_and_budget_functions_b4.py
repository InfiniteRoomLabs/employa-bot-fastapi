"""ai tables + budget functions (B4 sprint-05)

Revision ID: 9c4d1a7e2b31
Revises: 7a2c91d40e88
Create Date: 2026-07-15

Four tables for plan v3 Phase B item 4 (docs/sprints/sprint-05-spec.md):
``user_ai_budget`` (the ONE mutable row of the AI seam), ``ai_run``
(append-only run header, no status column -- PIN-A2), ``ai_run_event``
(append-only lifecycle events), ``match_report`` (append-only immutable
versions, current = MAX(version) -- PIN-A7). Conventions copied from the
sprint-02/03/04 exemplars: tenant ``user_id`` + CASCADE, ``UNIQUE(user_id,
id)`` anchors, FORCE RLS on the ``app.user_id`` GUC, timestamptz,
NUMERIC(10,6) money, named ``(...) IS TRUE`` CHECKs, ``schema_version``.

NET-NEW here (spec PINs):

* ``ai_reserve_run`` / ``ai_settle_run``: owner-owned SECURITY DEFINER, the
  ONLY writers of all four tables (PIN-A1). Reserve = the guarded UPDATE
  ``reserved_usd += max WHERE spent + reserved + max <= cap`` on the locked
  per-user month row (v3 Data-integrity #5/#6), server-derived idempotency
  key + open-run adoption (PIN-A3), ai_run + reserved-event INSERT in the
  same short transaction. Settle = terminal event + reservation->actual
  conversion (or full release on failure) + the match_report INSERT, under
  the same budget lock (PIN-A5/A6). SQLSTATEs: EMP00 missing GUC, EMP30
  cap_reached, EMP31 run not found, EMP32 already settled, EMP33 job/resume
  ownership (tenant-indistinguishable 404), EMP34 illegal settle payload.
* append-only enforcement + PIN-19-style narrowing: ai_run, ai_run_event,
  match_report get ``enforce_append_only`` AND INSERT revoked (SELECT-only);
  user_ai_budget is SELECT-only too (mutations only via the functions).
* partial unique indexes: exactly one ``reserved`` and at most one terminal
  event per run (uq_ai_run_event_reserved / uq_ai_run_event_terminal).
* ``delete_user_with_history`` extended (CREATE OR REPLACE) to disable the
  new append-only triggers for exactly one user-cascade DELETE (PIN-A14).

Composite FKs, partial indexes, RLS, append-only, grants, and functions are
raw ``op.execute`` -- the DEBT-6 autogenerate caveat. Downgrade raises:
forward-fix-only.
"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '9c4d1a7e2b31'
down_revision = '7a2c91d40e88'
branch_labels = None
depends_on = None

RESERVE_FN = r"""
CREATE FUNCTION ai_reserve_run(
    p_job_id uuid,
    p_resume_id uuid,
    p_kind text,
    p_provider text,
    p_model text,
    p_max_usd numeric,
    p_cap_usd numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_tenant uuid;
    v_month date;
    v_budget record;
    v_settled integer;
    v_key text;
    v_existing record;
    v_run_id uuid;
    v_created timestamptz;
BEGIN
    v_tenant := NULLIF(current_setting('app.user_id', true), '')::uuid;
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION 'app.user_id GUC is not set' USING ERRCODE = 'EMP00';
    END IF;

    -- Ownership checks, tenant-indistinguishable (AC-08): unknown and
    -- foreign ids raise the same SQLSTATE with the same message shape.
    PERFORM 1 FROM job WHERE id = p_job_id AND user_id = v_tenant;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'job not found' USING ERRCODE = 'EMP33';
    END IF;
    PERFORM 1 FROM resume WHERE id = p_resume_id AND user_id = v_tenant;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'resume not found' USING ERRCODE = 'EMP33';
    END IF;

    -- Current-month budget row (PIN-A12): created on first reservation,
    -- cap stamped from Settings; then LOCKED -- the lock serializes every
    -- reserve/settle for this tenant-month, making the key computation and
    -- the adoption check race-free.
    v_month := (date_trunc('month', now() AT TIME ZONE 'utc'))::date;
    INSERT INTO user_ai_budget (id, user_id, month_start, cap_usd)
    VALUES (gen_random_uuid(), v_tenant, v_month, p_cap_usd)
    ON CONFLICT (user_id, month_start) DO NOTHING;
    SELECT * INTO v_budget
    FROM user_ai_budget
    WHERE user_id = v_tenant AND month_start = v_month
    FOR UPDATE;

    -- Server-derived idempotency key (PIN-A3): settled-run count per triple.
    SELECT count(*) INTO v_settled
    FROM ai_run r
    WHERE r.user_id = v_tenant
      AND r.job_id = p_job_id
      AND r.resume_id = p_resume_id
      AND r.kind = p_kind
      AND EXISTS (
          SELECT 1 FROM ai_run_event e
          WHERE e.user_id = v_tenant AND e.run_id = r.id
            AND e.kind IN ('succeeded', 'failed')
      );
    v_key := p_kind || ':' || p_job_id || ':' || p_resume_id || ':' || v_settled;

    -- Adoption: an existing run under this key is necessarily OPEN (a
    -- settled run would have bumped the count and changed the key), so a
    -- retry after a post-reservation failure resumes it -- no second
    -- reservation, no double charge (conjunct 5).
    SELECT id, reserved_max_usd, created_at INTO v_existing
    FROM ai_run
    WHERE user_id = v_tenant AND idempotency_key = v_key;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'run_id', v_existing.id,
            'adopted', true,
            'reserved_max_usd', v_existing.reserved_max_usd,
            'run_created_at', v_existing.created_at,
            'cap_usd', v_budget.cap_usd,
            'spent_usd', v_budget.spent_usd,
            'reserved_usd', v_budget.reserved_usd
        );
    END IF;

    -- THE guarded reservation UPDATE (v3 Data-integrity #5): zero rows =
    -- the cap would be exceeded; nothing is inserted (checked BEFORE any
    -- spend is recorded, mock parity).
    UPDATE user_ai_budget
    SET reserved_usd = reserved_usd + p_max_usd,
        updated_at = statement_timestamp()
    WHERE id = v_budget.id
      AND user_id = v_tenant
      AND spent_usd + reserved_usd + p_max_usd <= cap_usd;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'monthly cap reached' USING ERRCODE = 'EMP30';
    END IF;

    v_run_id := gen_random_uuid();
    v_created := statement_timestamp();
    INSERT INTO ai_run (id, user_id, job_id, resume_id, budget_id, kind,
        provider, model, reserved_max_usd, idempotency_key, created_at)
    VALUES (v_run_id, v_tenant, p_job_id, p_resume_id, v_budget.id, p_kind,
        p_provider, p_model, p_max_usd, v_key, v_created);
    INSERT INTO ai_run_event (id, user_id, run_id, kind)
    VALUES (gen_random_uuid(), v_tenant, v_run_id, 'reserved');

    RETURN jsonb_build_object(
        'run_id', v_run_id,
        'adopted', false,
        'reserved_max_usd', p_max_usd,
        'run_created_at', v_created,
        'cap_usd', v_budget.cap_usd,
        'spent_usd', v_budget.spent_usd,
        'reserved_usd', v_budget.reserved_usd + p_max_usd
    );
END;
$fn$
"""

SETTLE_FN = r"""
CREATE FUNCTION ai_settle_run(
    p_run_id uuid,
    p_outcome text,
    p_actual_usd numeric DEFAULT NULL,
    p_score integer DEFAULT NULL,
    p_rubric jsonb DEFAULT NULL,
    p_gaps jsonb DEFAULT NULL,
    p_strengths jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_tenant uuid;
    v_run record;
    v_event_id uuid;
    v_event_at timestamptz;
    v_report_id uuid;
    v_version integer;
BEGIN
    v_tenant := NULLIF(current_setting('app.user_id', true), '')::uuid;
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION 'app.user_id GUC is not set' USING ERRCODE = 'EMP00';
    END IF;

    IF p_outcome NOT IN ('succeeded', 'failed') THEN
        RAISE EXCEPTION 'illegal outcome %', p_outcome USING ERRCODE = 'EMP34';
    END IF;
    IF p_outcome = 'succeeded' AND (p_actual_usd IS NULL OR p_score IS NULL
        OR p_rubric IS NULL OR p_gaps IS NULL OR p_strengths IS NULL) THEN
        RAISE EXCEPTION 'succeeded settlement requires cost and payload'
            USING ERRCODE = 'EMP34';
    END IF;
    IF p_actual_usd IS NOT NULL AND p_actual_usd < 0 THEN
        RAISE EXCEPTION 'actual cost may not be negative' USING ERRCODE = 'EMP34';
    END IF;

    SELECT * INTO v_run
    FROM ai_run
    WHERE id = p_run_id AND user_id = v_tenant;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'run not found' USING ERRCODE = 'EMP31';
    END IF;
    IF p_actual_usd IS NOT NULL AND p_actual_usd > v_run.reserved_max_usd THEN
        RAISE EXCEPTION 'actual cost exceeds the reservation'
            USING ERRCODE = 'EMP34';
    END IF;

    -- Lock the SAME budget row the reservation moved (stored, not derived
    -- from dates -- month-boundary safe). The lock serializes competing
    -- settles; the partial unique index is the DB backstop.
    PERFORM 1 FROM user_ai_budget
    WHERE id = v_run.budget_id AND user_id = v_tenant
    FOR UPDATE;

    PERFORM 1 FROM ai_run_event
    WHERE user_id = v_tenant AND run_id = p_run_id
      AND kind IN ('succeeded', 'failed');
    IF FOUND THEN
        RAISE EXCEPTION 'run already settled' USING ERRCODE = 'EMP32';
    END IF;

    v_event_id := gen_random_uuid();
    v_event_at := statement_timestamp();
    INSERT INTO ai_run_event (id, user_id, run_id, kind, actual_cost_usd,
        created_at)
    VALUES (v_event_id, v_tenant, p_run_id, p_outcome,
        CASE WHEN p_outcome = 'succeeded' THEN p_actual_usd END, v_event_at);

    IF p_outcome = 'succeeded' THEN
        -- Reservation -> actual conversion (v3 Data-integrity #6).
        UPDATE user_ai_budget
        SET reserved_usd = reserved_usd - v_run.reserved_max_usd,
            spent_usd = spent_usd + p_actual_usd,
            updated_at = statement_timestamp()
        WHERE id = v_run.budget_id AND user_id = v_tenant;

        SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
        FROM match_report
        WHERE user_id = v_tenant
          AND job_id = v_run.job_id
          AND resume_id = v_run.resume_id;
        v_report_id := gen_random_uuid();
        INSERT INTO match_report (id, user_id, job_id, resume_id, ai_run_id,
            version, score, rubric, gaps, strengths)
        VALUES (v_report_id, v_tenant, v_run.job_id, v_run.resume_id,
            p_run_id, v_version, p_score, p_rubric, p_gaps, p_strengths);
    ELSE
        -- Full release: the headroom is available again (PIN-A6).
        UPDATE user_ai_budget
        SET reserved_usd = reserved_usd - v_run.reserved_max_usd,
            updated_at = statement_timestamp()
        WHERE id = v_run.budget_id AND user_id = v_tenant;
    END IF;

    RETURN jsonb_build_object(
        'event_id', v_event_id,
        'event_created_at', v_event_at,
        'report_id', v_report_id,
        'version', v_version,
        'run_created_at', v_run.created_at,
        'job_id', v_run.job_id,
        'resume_id', v_run.resume_id,
        'reserved_max_usd', v_run.reserved_max_usd,
        'provider', v_run.provider,
        'model', v_run.model
    );
END;
$fn$
"""

# PIN-A14: the sprint-04 teardown helper, extended to the three new
# append-only tables. CREATE OR REPLACE: same name/signature/semantics.
DELETE_USER_FN = r"""
CREATE OR REPLACE FUNCTION delete_user_with_history(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
    ALTER TABLE stage_transition DISABLE TRIGGER append_only_guard;
    ALTER TABLE stage_transition DISABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE resume_snapshot DISABLE TRIGGER append_only_guard;
    ALTER TABLE resume_snapshot DISABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE ai_run DISABLE TRIGGER append_only_guard;
    ALTER TABLE ai_run DISABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE ai_run_event DISABLE TRIGGER append_only_guard;
    ALTER TABLE ai_run_event DISABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE match_report DISABLE TRIGGER append_only_guard;
    ALTER TABLE match_report DISABLE TRIGGER append_only_truncate_guard;
    DELETE FROM "user" WHERE id = p_user_id;
    ALTER TABLE stage_transition ENABLE TRIGGER append_only_guard;
    ALTER TABLE stage_transition ENABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE resume_snapshot ENABLE TRIGGER append_only_guard;
    ALTER TABLE resume_snapshot ENABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE ai_run ENABLE TRIGGER append_only_guard;
    ALTER TABLE ai_run ENABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE ai_run_event ENABLE TRIGGER append_only_guard;
    ALTER TABLE ai_run_event ENABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE match_report ENABLE TRIGGER append_only_guard;
    ALTER TABLE match_report ENABLE TRIGGER append_only_truncate_guard;
    RETURN FOUND;
END;
$fn$
"""


def upgrade():
    op.create_table('user_ai_budget',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('month_start', sa.Date(), nullable=False),
    sa.Column('cap_usd', sa.Numeric(precision=10, scale=6), nullable=False),
    sa.Column('reserved_usd', sa.Numeric(precision=10, scale=6), server_default='0', nullable=False),
    sa.Column('spent_usd', sa.Numeric(precision=10, scale=6), server_default='0', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('schema_version', sa.Integer(), server_default='1', nullable=False),
    sa.CheckConstraint('cap_usd > 0', name='ck_user_ai_budget_cap_positive'),
    sa.CheckConstraint('spent_usd >= 0', name='ck_user_ai_budget_spent_nonneg'),
    sa.CheckConstraint('reserved_usd >= 0', name='ck_user_ai_budget_reserved_nonneg'),
    sa.CheckConstraint('spent_usd + reserved_usd <= cap_usd', name='ck_user_ai_budget_cap'),
    sa.CheckConstraint('schema_version >= 1', name='ck_user_ai_budget_schema_version'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'id', name='uq_user_ai_budget_user_id_id'),
    sa.UniqueConstraint('user_id', 'month_start', name='uq_user_ai_budget_month')
    )
    op.create_index(op.f('ix_user_ai_budget_user_id'), 'user_ai_budget', ['user_id'], unique=False)
    op.create_table('ai_run',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('job_id', sa.Uuid(), nullable=False),
    sa.Column('resume_id', sa.Uuid(), nullable=False),
    sa.Column('budget_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('provider', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('model', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('reserved_max_usd', sa.Numeric(precision=10, scale=6), nullable=False),
    sa.Column('idempotency_key', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('schema_version', sa.Integer(), server_default='1', nullable=False),
    sa.CheckConstraint("kind IN ('deep_match_score')", name='ck_ai_run_kind'),
    sa.CheckConstraint('reserved_max_usd > 0', name='ck_ai_run_reserved_max_positive'),
    sa.CheckConstraint('schema_version >= 1', name='ck_ai_run_schema_version'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'id', name='uq_ai_run_user_id_id'),
    sa.UniqueConstraint('user_id', 'idempotency_key', name='uq_ai_run_idempotency')
    )
    op.create_index(op.f('ix_ai_run_user_id'), 'ai_run', ['user_id'], unique=False)
    op.create_table('ai_run_event',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('run_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('actual_cost_usd', sa.Numeric(precision=10, scale=6), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('schema_version', sa.Integer(), server_default='1', nullable=False),
    sa.CheckConstraint("kind IN ('reserved', 'succeeded', 'failed')", name='ck_ai_run_event_kind'),
    sa.CheckConstraint("(kind = 'succeeded') = (actual_cost_usd IS NOT NULL)", name='ck_ai_run_event_cost'),
    sa.CheckConstraint('actual_cost_usd IS NULL OR actual_cost_usd >= 0', name='ck_ai_run_event_cost_nonneg'),
    sa.CheckConstraint('schema_version >= 1', name='ck_ai_run_event_schema_version'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'id', name='uq_ai_run_event_user_id_id')
    )
    op.create_index(op.f('ix_ai_run_event_user_id'), 'ai_run_event', ['user_id'], unique=False)
    op.create_table('match_report',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('job_id', sa.Uuid(), nullable=False),
    sa.Column('resume_id', sa.Uuid(), nullable=False),
    sa.Column('ai_run_id', sa.Uuid(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('score', sa.Integer(), nullable=False),
    sa.Column('rubric', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('gaps', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('strengths', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('schema_version', sa.Integer(), server_default='1', nullable=False),
    sa.CheckConstraint('version >= 1', name='ck_match_report_version'),
    sa.CheckConstraint('score BETWEEN 0 AND 100', name='ck_match_report_score'),
    sa.CheckConstraint("(jsonb_typeof(rubric) = 'array') IS TRUE", name='ck_match_report_rubric'),
    sa.CheckConstraint("(jsonb_typeof(gaps) = 'array') IS TRUE", name='ck_match_report_gaps'),
    sa.CheckConstraint("(jsonb_typeof(strengths) = 'array') IS TRUE", name='ck_match_report_strengths'),
    sa.CheckConstraint('schema_version >= 1', name='ck_match_report_schema_version'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'id', name='uq_match_report_user_id_id'),
    sa.UniqueConstraint('user_id', 'ai_run_id', name='uq_match_report_run'),
    sa.UniqueConstraint('user_id', 'job_id', 'resume_id', 'version', name='uq_match_report_version')
    )
    op.create_index(op.f('ix_match_report_user_id'), 'match_report', ['user_id'], unique=False)

    # ------------------------------------------------------------------
    # Composite tenant FKs (spec schema section): every DB-entity reference
    # fails cross-tenant at the DB.
    # ------------------------------------------------------------------
    op.execute(
        "ALTER TABLE ai_run ADD CONSTRAINT fk_ai_run_job"
        " FOREIGN KEY (user_id, job_id) REFERENCES job (user_id, id)"
    )
    op.execute(
        "ALTER TABLE ai_run ADD CONSTRAINT fk_ai_run_resume"
        " FOREIGN KEY (user_id, resume_id) REFERENCES resume (user_id, id)"
    )
    op.execute(
        "ALTER TABLE ai_run ADD CONSTRAINT fk_ai_run_budget"
        " FOREIGN KEY (user_id, budget_id)"
        " REFERENCES user_ai_budget (user_id, id)"
    )
    op.execute(
        "ALTER TABLE ai_run_event ADD CONSTRAINT fk_ai_run_event_run"
        " FOREIGN KEY (user_id, run_id) REFERENCES ai_run (user_id, id)"
    )
    op.execute(
        "ALTER TABLE match_report ADD CONSTRAINT fk_match_report_job"
        " FOREIGN KEY (user_id, job_id) REFERENCES job (user_id, id)"
    )
    op.execute(
        "ALTER TABLE match_report ADD CONSTRAINT fk_match_report_resume"
        " FOREIGN KEY (user_id, resume_id) REFERENCES resume (user_id, id)"
    )
    op.execute(
        "ALTER TABLE match_report ADD CONSTRAINT fk_match_report_run"
        " FOREIGN KEY (user_id, ai_run_id) REFERENCES ai_run (user_id, id)"
    )

    # Exactly one reservation, at most one terminal event per run (PIN-A2).
    op.execute(
        "CREATE UNIQUE INDEX uq_ai_run_event_reserved ON ai_run_event"
        " (user_id, run_id) WHERE kind = 'reserved'"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_ai_run_event_terminal ON ai_run_event"
        " (user_id, run_id) WHERE kind IN ('succeeded', 'failed')"
    )

    # ------------------------------------------------------------------
    # Row-level security -- one policy per table, exemplar copy.
    # ------------------------------------------------------------------
    for table, policy in (
        ("user_ai_budget", "user_ai_budget_tenant_isolation"),
        ("ai_run", "ai_run_tenant_isolation"),
        ("ai_run_event", "ai_run_event_tenant_isolation"),
        ("match_report", "match_report_tenant_isolation"),
    ):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY {policy} ON {table}
            FOR ALL
            USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
            WITH CHECK (
                user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
            )
            """
        )

    # ------------------------------------------------------------------
    # Append-only enforcement + PIN-A1 narrowing: the three immutable tables
    # are SELECT-only for app_runtime (INSERT also revoked -- the functions
    # are the only writers); the budget row is SELECT-only too (its mutations
    # are the functions' whole reason to exist).
    # ------------------------------------------------------------------
    op.execute("SELECT enforce_append_only('ai_run')")
    op.execute("SELECT enforce_append_only('ai_run_event')")
    op.execute("SELECT enforce_append_only('match_report')")
    op.execute("REVOKE INSERT ON ai_run FROM app_runtime")
    op.execute("REVOKE INSERT ON ai_run_event FROM app_runtime")
    op.execute("REVOKE INSERT ON match_report FROM app_runtime")
    op.execute(
        "REVOKE INSERT, UPDATE, DELETE ON user_ai_budget FROM app_runtime"
    )

    # ------------------------------------------------------------------
    # The two budget functions + the extended teardown helper (PIN-A14).
    # ------------------------------------------------------------------
    op.execute(RESERVE_FN)
    op.execute(SETTLE_FN)
    op.execute(DELETE_USER_FN)
    op.execute("REVOKE ALL ON FUNCTION ai_reserve_run FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION ai_settle_run FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION ai_reserve_run TO app_runtime")
    op.execute("GRANT EXECUTE ON FUNCTION ai_settle_run TO app_runtime")
    # delete_user_with_history keeps its 7a2c91d40e88 grants: owner-only.


def downgrade():
    raise RuntimeError(
        "forward-fix only: this project does not support downgrades"
        " (plan v3, Migrations)"
    )
