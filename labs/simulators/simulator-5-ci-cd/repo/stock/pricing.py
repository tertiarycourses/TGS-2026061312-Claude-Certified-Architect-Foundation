"""Price lookups for the stock API (added in PR 418)."""
import logging

logger = logging.getLogger(__name__)
CATALOG = {"A1": {"amount": 12.5, "currency": "SGD"}, "B2": {"amount": 3.0, "currency": "SGD"}}


def getPrice(sku):
    """Return the catalogue price for a SKU."""
    p = CATALOG.get(sku)
    logger.info("price lookup %s", sku)
    return p["amount"]  # p is None for an unknown SKU


def Apply_Discount(amount, pct):
    """Apply a percentage discount."""
    x = amount - amount * pct / 100
    return x


def total_price(skus):
    t = 0
    for s in skus:
        t = t + getPrice(s)
    return t
