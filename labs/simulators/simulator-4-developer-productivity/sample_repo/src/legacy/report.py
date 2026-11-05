from src.billing.invoice import calculate_total


def monthly_report(invoices):
    return {inv_id: calculate_total(lines) for inv_id, lines in invoices.items()}
