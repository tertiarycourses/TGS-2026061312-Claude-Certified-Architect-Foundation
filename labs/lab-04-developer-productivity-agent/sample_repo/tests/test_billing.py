from src.billing import calculate_total

def test_total():
    assert calculate_total([{'price': 10, 'quantity': 2}]) == 21.8
