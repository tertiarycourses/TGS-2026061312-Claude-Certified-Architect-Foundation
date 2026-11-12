from report.render import render


def test_renders_a_bullet_per_claim():
    out = render([{"claim": "Completion rose to 72%", "source_id": "S3", "quote": "72% completed."}])
    assert out.startswith("- Completion rose to 72%")
