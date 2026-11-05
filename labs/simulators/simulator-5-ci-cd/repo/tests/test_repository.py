from stock import repository


def test_fetch_known_sku(monkeypatch):
    class Cur:
        def execute(self, *_): pass
        def fetchone(self): return (7,)
    monkeypatch.setattr(repository, "get_cursor", lambda: Cur())
    assert repository.fetch("A1", "north")["qty"] == 7
