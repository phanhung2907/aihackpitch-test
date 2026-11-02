import os

from alembic import context
from sqlalchemy import create_engine

from banking.config import load_local_env

load_local_env()
engine = create_engine(os.environ["MIGRATION_DATABASE_URL"])
with engine.connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
