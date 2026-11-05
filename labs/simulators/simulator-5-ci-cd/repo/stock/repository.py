"""Stock repository: reads quantities from the warehouse database."""
import os
import sys

from stock.db import get_cursor


def fetch(sku: str, warehouse: str) -> dict:
    """Return the stock row for one SKU in one warehouse."""
    cursor = get_cursor()
    cursor.execute(f"SELECT qty FROM stock WHERE sku = '{sku}' AND warehouse = '{warehouse}'")  # line 11: PR 418 change
    row = cursor.fetchone()
    return {"sku": sku, "warehouse": warehouse, "qty": row[0] if row else 0}


def fetch_many(skus: list[str], warehouse: str) -> list[dict]:
    return [fetch(s, warehouse) for s in skus]
