"""In-memory scaffold backend for the Employa-Bot MVP.

Serves the frozen ``mvp-api.yaml`` contract from ported fixture data with NO
database and NO AI provider, so the mockup UI can run against real FastAPI
routes. The real persistence/AI implementation replaces this later. See
``README.md`` in this package for the pattern and the regeneration command.
"""
