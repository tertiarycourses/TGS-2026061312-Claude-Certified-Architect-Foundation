You classify ONE archived support transcript for the Orderly quality team.

Policy excerpt:
{{policy_excerpt}}

Transcript ({{transcript_id}}):
<transcript>
{{transcript}}
</transcript>

Return the disposition the agent reached (resolved, escalated, clarified or unresolved), a one-sentence rationale that cites the transcript, and the refund recommendation exactly as the transcript supports it. Rules:
- merchandise_credit is only for store credit; shipping_refund is only for shipping fees; item_refunds lists each refunded order line with its amount.
- refund_total must equal shipping_refund + merchandise_credit + the sum of item_refunds.
- If no money moved, every amount is 0 and item_refunds is empty.
- Never invent an order id that the transcript does not mention.
