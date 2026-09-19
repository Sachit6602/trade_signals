import pandas as pd

import daily
from daily import Analysis, daily_closure


def test_entry_ready_needs_full_checklist(monkeypatch):
    bars = pd.DataFrame({"time": pd.date_range("2026-09-01", periods=3, tz="UTC"), "open": 1.0, "high": 1.1, "low": 0.9, "close": 1.0})
    monkeypatch.setattr(daily, "candles", lambda pair, tf, count: bars)
    fake = dict(bias="bullish", confidence=130, bias_reason="", weekly_context="", points_of_interest=[], draw_on_liquidity="",
                setup="entry_ready", plan="", entry=1, stop=0.9, target=1.2, swing_formed=True, cisd_formed=False, ltf_continuation=True)
    monkeypatch.setattr(daily, "ask", lambda prompt, model: Analysis(**fake))
    a, _ = daily.analyze({"method": "m"}, "EUR_USD")
    assert (a.setup, a.confidence) == ("watch", 100)


def day(prev, last):
    return pd.DataFrame([dict(zip(["open", "high", "low", "close"], c)) for c in (prev, last)])


def test_daily_closure():
    prev = (1.10, 1.12, 1.08, 1.11)
    assert daily_closure(day(prev, (1.11, 1.13, 1.10, 1.125))).startswith("bullish continuation")
    assert daily_closure(day(prev, (1.09, 1.10, 1.07, 1.075))).startswith("bearish continuation")
    assert daily_closure(day(prev, (1.09, 1.10, 1.07, 1.09))).startswith("bullish reversal")
    assert daily_closure(day(prev, (1.11, 1.13, 1.10, 1.11))).startswith("bearish reversal")
    assert daily_closure(day(prev, (1.10, 1.13, 1.07, 1.10))).startswith("swept both")
    assert daily_closure(day(prev, (1.10, 1.11, 1.09, 1.10))).startswith("inside")
