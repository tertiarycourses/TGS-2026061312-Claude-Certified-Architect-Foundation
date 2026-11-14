"""Three messy invoices: one clean, one with no due date, one whose lines don't add up to the total."""
INVOICES = {
    "INV-1001": """ACME Supplies Pte Ltd   Invoice INV-1001   Date: 3 Nov 2026   Due: 3 Dec 2026
2 x Office chair @ $180.00 = $360.00
1 x Desk lamp @ $45.50 = $45.50
TOTAL: $405.50""",
    "INV-1002": """Bright Print  |  inv no INV-1002  |  issued 05/11/2026
Business cards (500) .... 89.00
Flyers A5 (1000) ........ 140.00
Amount payable 229.00 SGD""",
    "INV-1003": """Nova Cloud Services   Invoice: INV-1003   Date 2026-11-07   Due 2026-11-21
Hosting plan (Nov)   1   $300.00
Extra storage 200GB  1   $40.00
Total due: $390.00""",
}
