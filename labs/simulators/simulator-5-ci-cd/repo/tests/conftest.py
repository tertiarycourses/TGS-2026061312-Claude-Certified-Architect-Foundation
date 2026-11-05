import pytest
from types import SimpleNamespace


@pytest.fixture
def sample_stock():
    return [SimpleNamespace(sku="A1", qty=3), SimpleNamespace(sku="B2", qty=0), SimpleNamespace(sku="C3", qty=9)]


@pytest.fixture
def empty_stock():
    return []
