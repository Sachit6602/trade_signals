import pandas as pd
import pytest

from scan import add_indicators, all_met, check_strategy_valid, levels


def flat_then_jump():
    close = [1.0] * 60 + [1.1]
    return add_indicators(
        pd.DataFrame({"open": close, "high": [c + 0.001 for c in close], "low": [c - 0.001 for c in close],
                      "close": close, "hour": 8}),
        [{"name": "sma20", "type": "sma", "source": "close", "period": 20, "period2": 0, "period3": 0, "std": 0}],
    )


def test_rules():
    df = flat_then_jump()
    assert all_met(df, [{"left": "close", "op": "crosses_above", "right": "sma20"}])
    assert not all_met(df, [{"left": "close", "op": "crosses_below", "right": "sma20"}])
    assert all_met(df, [{"left": "close[1]", "op": "<", "right": "close"}, {"left": "hour", "op": ">=", "right": "7"}])
    assert not all_met(df, [])  # no short rules = no short signals


def test_unknown_column_rejected():
    s = {"indicators": [], "long_when": [{"left": "ema50", "op": ">", "right": "close"}], "short_when": []}
    with pytest.raises(KeyError):
        check_strategy_valid(s)


def test_levels_long_rr2():
    df = flat_then_jump()
    s = {"stop_loss": "pips", "stop_value": 20, "take_profit_rr": 2}
    assert levels(df, s, "EUR_USD", "LONG") == (1.1, 1.098, 1.104)
    assert levels(df, s, "EUR_USD", "SHORT") == (1.1, 1.102, 1.096)
