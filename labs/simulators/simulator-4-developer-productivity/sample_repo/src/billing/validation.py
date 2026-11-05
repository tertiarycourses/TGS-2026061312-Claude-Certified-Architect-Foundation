from decimal import Decimal
from .invoice import calculate_total


def validate_invoice(lines, stated_total):
    computed = calculate_total(lines)
    if abs(computed - Decimal(stated_total)) > Decimal("0.01"):
        raise ValueError(f"stated {stated_total} != computed {computed}")
    return computed
