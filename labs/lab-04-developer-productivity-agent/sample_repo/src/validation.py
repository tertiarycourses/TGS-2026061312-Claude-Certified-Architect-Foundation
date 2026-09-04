def validate_items(items):
    if not items:
        raise ValueError('items required')
    if any(i['price'] < 0 or i['quantity'] <= 0 for i in items):
        raise ValueError('invalid invoice item')
