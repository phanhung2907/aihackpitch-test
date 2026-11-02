FROM ghcr.io/astral-sh/uv:0.12.13@sha256:b485bd65cc2cf1c9a93b3554012c9c3778cf7b1b5fd3d3096ce9e1226c97e1e6 AS uv
FROM python:3.13-slim-bookworm@sha256:281d39ff02e3b389401586134ff9e6572954687822a58055ec07a60ded4e0b7f
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /srv/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-cache
COPY backend/banking ./banking
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
COPY contracts /srv/contracts
ENV PATH="/srv/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1
RUN useradd --uid 10001 --create-home bank
USER bank
EXPOSE 8000
CMD ["uvicorn", "banking.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
