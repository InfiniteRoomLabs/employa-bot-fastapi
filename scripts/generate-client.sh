#! /usr/bin/env bash

set -e
set -x

# Contract-first generation (docs/mvp-plan.md, "Contract fidelity checks"):
# BOTH generated artifacts -- backend/app/schemas.py and frontend/src/client --
# come from the frozen mvp-api.yaml. The runtime OpenAPI is what gets COMPARED
# against the contract, never the generator source. CI's generated-diff job
# runs this script and fails on any resulting diff.

cd "$(dirname "$0")/.."

# Backend wire models (post-gen fixup documented in backend/README.md).
cd backend
uv run datamodel-codegen \
  --input ../mvp-api.yaml \
  --input-file-type openapi \
  --output app/schemas.py \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.14 \
  --use-standard-collections \
  --use-union-operator \
  --use-schema-description \
  --use-field-description \
  --field-constraints \
  --disable-timestamp \
  --use-double-quotes \
  --collapse-root-models \
  --formatters black isort
sed -i 's/    source: TransitionSource | None = "user"/    source: TransitionSource | None = TransitionSource.user/' app/schemas.py
cd ..

# Frontend client (openapi-ts.config.ts reads ../mvp-api.yaml directly).
bun run --filter frontend generate-client
bun run lint
