"""The AI provider seam (plan v3 Phase B item 4; sprint-05 spec PIN-A8/A9).

``base`` defines the provider ABC and its input/outcome shapes; ``fake``
is the deterministic, explicit-only FakeAiProvider; ``factory`` is the ONE
construction site (``get_provider``). Routes never import a concrete
provider class -- only the factory.
"""
