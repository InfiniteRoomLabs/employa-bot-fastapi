"""stage-mutation function + soft-remove + teardown helpers (B3b sprint-04)

Revision ID: 7a2c91d40e88
Revises: 5f1fb22cd505
Create Date: 2026-07-14

The ONE permitted stage mutation (plan v3 line 38 / spec PIN-1): owner-owned
SECURITY DEFINER ``application_stage_transition`` -- the guarded versioned
UPDATE (PG18 ``RETURNING old.stage``; zero rows aborts BEFORE any child
write), the seq-anchored history append, the APPLIED snapshot + resume lock
in the SAME transaction (PIN-2), the atomic undo-grant mint/claim on
PostgreSQL time (PIN-4), and the compensating-transition undo (PIN-3).
app_runtime holds EXECUTE but no direct DML on the history tables (PIN-19),
so the function is the only writer of stage/version/outcome/history.

Tenant identity comes from the ``app.user_id`` GUC INSIDE the function (never
a parameter): SECURITY DEFINER bypasses RLS, so every statement carries an
explicit ``user_id = v_tenant`` predicate.

Error taxonomy (route maps SQLSTATE -> ApiError envelope, mock check order):
EMP00 missing GUC (500-class bug), EMP04 not-found, EMP09 version conflict,
EMP22 invalid transition, EMP4A undo window expired.

Also: ``application_soft_remove`` (PIN-14 pre-commit dismiss; application
UPDATE is revoked from app_runtime so even ``removed_at`` needs a definer
helper) and ``delete_user_with_history`` (PIN-11: append-only triggers block
even owner cascades, so user teardown disables them for exactly one DELETE
inside one transaction -- v3 line 37's documented owner boundary; NOT granted
to app_runtime).

Downgrade raises: forward-fix-only.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "7a2c91d40e88"
down_revision = "5f1fb22cd505"
branch_labels = None
depends_on = None

STAGE_TRANSITION_FN = r"""
CREATE FUNCTION application_stage_transition(
    p_application_id uuid,
    p_target_stage text,
    p_allowed_from text[],
    p_expected_version integer DEFAULT NULL,
    p_source text DEFAULT 'user',
    p_reason text DEFAULT NULL,
    p_reasons jsonb DEFAULT NULL,
    p_resume_id uuid DEFAULT NULL,
    p_outcome text DEFAULT NULL,
    p_outcome_reason text DEFAULT NULL,
    p_outcome_reasons jsonb DEFAULT NULL,
    p_clear_outcome boolean DEFAULT false,
    p_set_resurrected boolean DEFAULT false,
    p_mint_undo_grant boolean DEFAULT false,
    p_undo_window_seconds integer DEFAULT NULL,
    p_consume_grant uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_tenant uuid;
    v_target text := p_target_stage;
    v_from_stage text;
    v_new_version integer;
    v_corrects uuid;
    v_seq integer;
    v_transition_id uuid;
    v_snapshot_id uuid;
    v_grant_id uuid;
    v_grant_expires timestamptz;
    v_resume record;
    v_probe record;
BEGIN
    v_tenant := NULLIF(current_setting('app.user_id', true), '')::uuid;
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION 'app.user_id GUC is not set' USING ERRCODE = 'EMP00';
    END IF;

    -- undo: claim the grant FIRST, atomically on PostgreSQL time (PIN-4).
    IF p_consume_grant IS NOT NULL THEN
        UPDATE undo_grant
        SET consumed_at = statement_timestamp()
        WHERE id = p_consume_grant
          AND user_id = v_tenant
          AND application_id = p_application_id
          AND consumed_at IS NULL
          AND expires_at >= statement_timestamp()
        RETURNING corrects_transition_id INTO v_corrects;
        IF v_corrects IS NULL THEN
            PERFORM 1 FROM undo_grant
            WHERE id = p_consume_grant
              AND user_id = v_tenant
              AND application_id = p_application_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'unknown undo grant' USING ERRCODE = 'EMP04';
            END IF;
            RAISE EXCEPTION 'the undo window has expired'
                USING ERRCODE = 'EMP4A';
        END IF;
        -- the compensating target is the corrected transition's from_stage
        SELECT from_stage INTO v_target
        FROM stage_transition
        WHERE id = v_corrects AND user_id = v_tenant;
    END IF;

    -- THE guarded versioned UPDATE (v3 Data-integrity #1): zero rows aborts
    -- before any child write. A same-version race loser blocks on the row
    -- lock, wakes to a bumped version, matches zero rows.
    UPDATE application
    SET stage = v_target,
        version = version + 1,
        outcome = CASE WHEN p_clear_outcome THEN NULL
                       ELSE COALESCE(p_outcome, outcome) END,
        outcome_at = CASE WHEN p_clear_outcome THEN NULL
                          WHEN p_outcome IS NOT NULL THEN statement_timestamp()
                          ELSE outcome_at END,
        outcome_reason = CASE WHEN p_clear_outcome THEN NULL
                              ELSE COALESCE(p_outcome_reason, outcome_reason)
                         END,
        outcome_reasons = CASE WHEN p_clear_outcome THEN NULL
                               ELSE COALESCE(p_outcome_reasons, outcome_reasons)
                          END,
        resurrected = CASE WHEN p_set_resurrected THEN true
                           ELSE resurrected END
    WHERE id = p_application_id
      AND user_id = v_tenant
      AND removed_at IS NULL
      AND (p_expected_version IS NULL OR version = p_expected_version)
      AND stage = ANY (p_allowed_from)
    RETURNING old.stage, new.version INTO v_from_stage, v_new_version;

    IF v_from_stage IS NULL THEN
        -- diagnose in the mock's check order (404 -> 409 -> invalid_transition)
        SELECT stage, version INTO v_probe
        FROM application
        WHERE id = p_application_id AND user_id = v_tenant
          AND removed_at IS NULL;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'application not found' USING ERRCODE = 'EMP04';
        ELSIF p_expected_version IS NOT NULL
              AND v_probe.version <> p_expected_version THEN
            RAISE EXCEPTION 'expectedVersion % != current %',
                p_expected_version, v_probe.version USING ERRCODE = 'EMP09';
        END IF;
        RAISE EXCEPTION '% -> % is not a legal transition',
            v_probe.stage, v_target USING ERRCODE = 'EMP22';
    END IF;

    -- history append; seq is serialized by the application row lock.
    SELECT COALESCE(MAX(seq), 0) + 1 INTO v_seq
    FROM stage_transition
    WHERE user_id = v_tenant AND application_id = p_application_id;

    v_transition_id := gen_random_uuid();
    INSERT INTO stage_transition (id, user_id, application_id, seq, from_stage,
        to_stage, source, reason, reasons, resume_id, corrects_transition_id)
    VALUES (v_transition_id, v_tenant, p_application_id, v_seq, v_from_stage,
        v_target, p_source, p_reason, p_reasons,
        CASE WHEN v_target = 'applied' THEN p_resume_id END,
        v_corrects);

    -- APPLIED: snapshot + resume lock + projection, SAME transaction (PIN-2).
    -- Skipped for undo-restores and reactivation (both re-enter a stage the
    -- application already snapshotted for, or never legally passed applied).
    IF v_target = 'applied' AND p_consume_grant IS NULL
       AND NOT p_set_resurrected THEN
        SELECT id, name, body INTO v_resume
        FROM resume
        WHERE id = p_resume_id AND user_id = v_tenant;
        IF NOT FOUND THEN
            -- missing OR foreign resume: tenant-indistinguishable (AC-08;
            -- deviation from the mock's tolerant synthesis, spec 3b design)
            RAISE EXCEPTION 'resume not found' USING ERRCODE = 'EMP04';
        END IF;
        v_snapshot_id := gen_random_uuid();
        INSERT INTO resume_snapshot (id, user_id, application_id, resume_id,
            name, body, template_version)
        VALUES (v_snapshot_id, v_tenant, p_application_id, v_resume.id,
            COALESCE(v_resume.name, 'Submitted resume'),
            COALESCE(v_resume.body, 'Submitted resume -- locked at APPLIED.'),
            'v1');
        UPDATE resume SET used_in = used_in + 1
        WHERE id = v_resume.id AND user_id = v_tenant;
        UPDATE application
        SET submitted_snapshot_id = v_snapshot_id, resume_id = v_resume.id
        WHERE id = p_application_id AND user_id = v_tenant;
    END IF;

    -- markWon: mint the persistent, restart-safe undo grant (PIN-4).
    IF p_mint_undo_grant THEN
        IF p_undo_window_seconds IS NULL THEN
            RAISE EXCEPTION 'undo window seconds required to mint a grant'
                USING ERRCODE = 'EMP00';
        END IF;
        v_grant_id := gen_random_uuid();
        v_grant_expires := statement_timestamp()
            + make_interval(secs => p_undo_window_seconds);
        INSERT INTO undo_grant (id, user_id, application_id,
            corrects_transition_id, expires_at)
        VALUES (v_grant_id, v_tenant, p_application_id, v_transition_id,
            v_grant_expires);
    END IF;

    RETURN jsonb_build_object(
        'new_version', v_new_version,
        'from_stage', v_from_stage,
        'to_stage', v_target,
        'transition_id', v_transition_id,
        'snapshot_id', v_snapshot_id,
        'grant_id', v_grant_id,
        'grant_expires_at', v_grant_expires
    );
END;
$fn$
"""

SOFT_REMOVE_FN = r"""
CREATE FUNCTION application_soft_remove(p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_tenant uuid;
BEGIN
    v_tenant := NULLIF(current_setting('app.user_id', true), '')::uuid;
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION 'app.user_id GUC is not set' USING ERRCODE = 'EMP00';
    END IF;
    UPDATE application SET removed_at = statement_timestamp()
    WHERE id = p_application_id AND user_id = v_tenant
      AND removed_at IS NULL AND stage IN ('saved', 'drafting');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'application not found' USING ERRCODE = 'EMP04';
    END IF;
    RETURN true;
END;
$fn$
"""

DELETE_USER_FN = r"""
CREATE FUNCTION delete_user_with_history(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    ALTER TABLE stage_transition DISABLE TRIGGER append_only_guard;
    ALTER TABLE stage_transition DISABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE resume_snapshot DISABLE TRIGGER append_only_guard;
    ALTER TABLE resume_snapshot DISABLE TRIGGER append_only_truncate_guard;
    DELETE FROM "user" WHERE id = p_user_id;
    ALTER TABLE stage_transition ENABLE TRIGGER append_only_guard;
    ALTER TABLE stage_transition ENABLE TRIGGER append_only_truncate_guard;
    ALTER TABLE resume_snapshot ENABLE TRIGGER append_only_guard;
    ALTER TABLE resume_snapshot ENABLE TRIGGER append_only_truncate_guard;
    RETURN FOUND;
END;
$fn$
"""


def upgrade():
    op.execute(STAGE_TRANSITION_FN)
    op.execute(SOFT_REMOVE_FN)
    op.execute(DELETE_USER_FN)
    op.execute(
        "REVOKE ALL ON FUNCTION application_stage_transition FROM PUBLIC"
    )
    op.execute("REVOKE ALL ON FUNCTION application_soft_remove FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION delete_user_with_history FROM PUBLIC")
    op.execute(
        "GRANT EXECUTE ON FUNCTION application_stage_transition TO app_runtime"
    )
    op.execute("GRANT EXECUTE ON FUNCTION application_soft_remove TO app_runtime")
    # delete_user_with_history: owner/admin paths only -- NOT app_runtime.


def downgrade():
    raise RuntimeError(
        "forward-fix only: this project does not support downgrades"
        " (plan v3, Migrations)"
    )
