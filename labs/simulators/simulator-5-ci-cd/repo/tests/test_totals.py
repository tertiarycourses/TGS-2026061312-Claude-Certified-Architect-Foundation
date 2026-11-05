from stock.totals import total_qty


def test_total_counts_all_items(sample_stock):
    assert total_qty(sample_stock) == 12
