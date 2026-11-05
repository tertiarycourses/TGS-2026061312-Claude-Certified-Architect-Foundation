"""Nightly stock sync job."""
import logging

from stock import api

logger = logging.getLogger(__name__)


def sync(skus: list[str]) -> list[dict]:
    out = []
    for sku in skus:
        stock = api.get_stock(sku)  # caller not updated in PR 418
        out.append(stock)
    logger.info("job done")
    return out
