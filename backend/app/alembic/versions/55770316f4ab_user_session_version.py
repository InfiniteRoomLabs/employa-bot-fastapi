"""user session_version

Revision ID: 55770316f4ab
Revises: 075675058c67
Create Date: 2026-07-13 17:30:32.790113

Adds ``user.session_version`` -- the counter behind the JWT ``sv`` claim
(plan v3 Auth conventions): bumping it invalidates every outstanding token
for that user. Downgrade raises per the forward-fix-only policy.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "55770316f4ab"
down_revision = "075675058c67"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column(
            "session_version", sa.Integer(), nullable=False, server_default="0"
        ),
    )


def downgrade():
    raise RuntimeError(
        "forward-fix only: this project does not support downgrades"
        " (plan v3, Migrations)"
    )
