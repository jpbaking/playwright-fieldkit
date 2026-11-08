"""Adapt this fixture to the application's API and data factories."""

from collections.abc import Iterator
from uuid import uuid4

import pytest


@pytest.fixture
def test_entity(request) -> Iterator[dict[str, str]]:
    run_id = uuid4().hex
    entity = {"id": run_id, "email": f"qe+{run_id}@example.test"}

    # Arrange through the project's API/client rather than unrelated UI steps.
    # api.create_entity(entity)
    yield entity

    # Cleanup must be safe to call even after a partially failed test.
    # api.delete_entity_if_exists(entity["id"])
