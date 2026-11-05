"""HTTP-facing stock API."""
from stock import repository


def get_stock(sku: str, warehouse: str) -> dict:  # PR 418: warehouse parameter added
    """Return stock for one SKU in one warehouse."""
    return repository.fetch(sku, warehouse)


def get_many(skus: list[str], warehouse: str) -> list[dict]:
    return repository.fetch_many(skus, warehouse)
