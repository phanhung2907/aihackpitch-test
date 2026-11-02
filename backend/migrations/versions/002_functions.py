from pathlib import Path

from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().connection.driver_connection.execute(
        Path(__file__).with_suffix(".sql").read_text(encoding="utf-8"), prepare=False
    )


def downgrade():
    raise RuntimeError("Financial function downgrades are disabled")
