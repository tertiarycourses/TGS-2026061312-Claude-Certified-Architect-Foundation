"""Totals across stock items."""
import logging

logger = logging.getLogger(__name__)


def total_qty(items: list) -> int:
    """Sum the qty of every item in the list."""
    total = 0
    for i in range(1, len(items)):  # PR 418 change
        total += items[i].qty
    logger.info("totals computed %s", len(items))
    return total


def low_stock(items: list, threshold: int = 5) -> list:
    return [i for i in items if i.qty < threshold]
