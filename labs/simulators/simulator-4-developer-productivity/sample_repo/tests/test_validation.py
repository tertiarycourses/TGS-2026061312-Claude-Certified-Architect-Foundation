import pytest
from src.billing.validation import validate_invoice


def test_rejects_mismatch():
    with pytest.raises(ValueError):
        validate_invoice([(1, "10.00")], "99.00")
