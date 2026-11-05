from decimal import Decimal
from src.billing.invoice import calculate_total


def test_total_with_tax():
    assert calculate_total([(2, "10.00")]) == Decimal("21.80")
