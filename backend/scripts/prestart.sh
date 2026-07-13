#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations
alembic upgrade head

# Create initial data in DB
python app/initial_data.py

# Seed demo data (opt-in, e.g. local/staging demo environments)
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
    python -m app.scripts.seed
fi
