#! /usr/bin/env sh

# Full-stack test cycle from scratch. The backend image intentionally ships
# no tests/ (production image), so the suite runs on the HOST against the
# compose db -- the same canonical recipe CI (test-backend.yml) and every
# sprint's evidence used. Requires uv (https://docs.astral.sh/uv/).

# Exit in case of error
set -e
set -x

docker compose build
docker compose down -v --remove-orphans # Remove possibly previous broken stacks left hanging after an error
docker compose up -d --wait backend db
(cd backend && uv sync && POSTGRES_SERVER=localhost uv run pytest "$@")
docker compose down -v --remove-orphans
