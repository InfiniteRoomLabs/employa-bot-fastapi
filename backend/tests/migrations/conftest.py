"""Migration-gate fixtures.

Nothing needed today: the parent ``tests/conftest.py`` has no autouse
fixtures (the DB world is pulled explicitly), and migration tests manage
their own scratch database. This file stays as the anchor for future
migration-test fixtures.
"""
