from pathlib import Path

from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).with_name("001_schema.sql").read_text(encoding="utf-8-sig")
    op.get_bind().connection.driver_connection.execute(sql, prepare=False)


def downgrade():
    raise RuntimeError(
        "Destructive financial downgrade is disabled; restore a verified backup instead"
    )
