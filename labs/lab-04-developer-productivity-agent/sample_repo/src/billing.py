from .validation import validate_items

def calculate_total(items, tax_rate=0.09):
    validate_items(items)
    subtotal = sum(item['price'] * item['quantity'] for item in items)
    return round(subtotal * (1 + tax_rate), 2)
