"""Run by cron: check saved strategies on the latest closed candle, send Telegram alerts."""
import json
import os
import re
from pathlib import Path

import numpy as np
import pandas as pd
import requests

HERE = Path(__file__).parent
STATE = HERE / "state.json"
OANDA_URL = os.environ.get("OANDA_URL", "https://api-fxpractice.oanda.com")


def add_indicators(df: pd.DataFrame, indicators: list[dict]) -> pd.DataFrame:
    h, l, c = df["high"], df["low"], df["close"]
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    df["_atr14"] = tr.ewm(alpha=1 / 14, adjust=False).mean()
    for ind in indicators:
        n, p, src = ind["name"], ind["period"], df[ind["source"]]
        t = ind["type"]
        if t == "ema":
            df[n] = src.ewm(span=p, adjust=False).mean()
        elif t == "sma":
            df[n] = src.rolling(p).mean()
        elif t == "rsi":
            d = src.diff()
            up = d.clip(lower=0).ewm(alpha=1 / p, adjust=False).mean()
            down = (-d.clip(upper=0)).ewm(alpha=1 / p, adjust=False).mean()
            df[n] = 100 - 100 / (1 + up / down)
        elif t == "atr":
            df[n] = tr.ewm(alpha=1 / p, adjust=False).mean()
        elif t == "macd":
            df[n] = src.ewm(span=p, adjust=False).mean() - src.ewm(span=ind["period2"], adjust=False).mean()
            df[n + "_signal"] = df[n].ewm(span=ind["period3"], adjust=False).mean()
            df[n + "_hist"] = df[n] - df[n + "_signal"]
        elif t == "bbands":
            mid, sd = src.rolling(p).mean(), src.rolling(p).std()
            df[n + "_mid"], df[n + "_upper"], df[n + "_lower"] = mid, mid + ind["std"] * sd, mid - ind["std"] * sd
        elif t == "highest":
            df[n] = src.rolling(p).max()
        elif t == "lowest":
            df[n] = src.rolling(p).min()
    return df


def value(df: pd.DataFrame, token: str, back: int = 0) -> float:
    """'1.2' -> 1.2, 'ema50' -> last closed bar, 'high[1]' -> previous bar. back shifts further for crosses."""
    try:
        return float(token)
    except ValueError:
        pass
    m = re.fullmatch(r"\s*([A-Za-z_]\w*)\s*(?:\[(\d+)\])?\s*", token)
    if not m or m[1] not in df:
        raise KeyError(f"unknown column in condition: {token!r}")
    return float(df[m[1]].iloc[-1 - int(m[2] or 0) - back])


def condition_met(df: pd.DataFrame, cond: dict) -> bool:
    a, b, op = value(df, cond["left"]), value(df, cond["right"]), cond["op"]
    if op in ("crosses_above", "crosses_below"):
        pa, pb = value(df, cond["left"], 1), value(df, cond["right"], 1)
        return pa <= pb and a > b if op == "crosses_above" else pa >= pb and a < b
    return {">": a > b, "<": a < b, ">=": a >= b, "<=": a <= b}[op]


def all_met(df, conds) -> bool:
    return bool(conds) and all(condition_met(df, c) for c in conds)  # NaN compares False, so warm-up bars never fire


def check_strategy_valid(s: dict):
    """Evaluate every condition on fake data so bad column names fail at save time, not at 3am."""
    close = pd.Series(1 + np.cumsum(np.random.default_rng(0).normal(0, 0.001, 600)))
    df = pd.DataFrame({"open": close, "high": close + 0.001, "low": close - 0.001, "close": close, "hour": 0})
    add_indicators(df, s["indicators"])
    for c in s["long_when"] + s["short_when"]:
        condition_met(df, c)


def levels(df: pd.DataFrame, s: dict, pair: str, side: str) -> tuple[float, float, float]:
    pip = 0.01 if "JPY" in pair else 0.1 if "XAU" in pair else 0.0001
    entry = float(df["close"].iloc[-1])
    if s["stop_loss"] == "atr":
        dist = s["stop_value"] * float(df["_atr14"].iloc[-1])
    elif s["stop_loss"] == "pips":
        dist = s["stop_value"] * pip
    else:  # swing
        bars = df.iloc[-int(s["stop_value"]):]
        dist = entry - bars["low"].min() if side == "LONG" else bars["high"].max() - entry
    dist = max(dist, pip)  # ponytail: floor at 1 pip so a flat swing never yields a zero stop
    sign = 1 if side == "LONG" else -1
    digits = 3 if pip >= 0.01 else 5
    return round(entry, digits), round(entry - sign * dist, digits), round(entry + sign * s["take_profit_rr"] * dist, digits)


def candles(pair: str, tf: str, count: int = 500) -> pd.DataFrame:
    r = requests.get(
        f"{OANDA_URL}/v3/instruments/{pair}/candles",
        params={"granularity": tf, "count": count, "price": "M"},
        headers={"Authorization": f"Bearer {os.environ['OANDA_TOKEN']}"},
        timeout=20,
    )
    r.raise_for_status()
    df = pd.DataFrame([
        {"time": x["time"], "open": float(x["mid"]["o"]), "high": float(x["mid"]["h"]),
         "low": float(x["mid"]["l"]), "close": float(x["mid"]["c"])}
        for x in r.json()["candles"] if x["complete"]
    ])
    df["time"] = pd.to_datetime(df["time"])
    df["hour"] = df["time"].dt.hour
    return df


def notify(text: str):
    token, chat = os.environ["TELEGRAM_TOKEN"], os.environ["TELEGRAM_CHAT_ID"]
    requests.post(f"https://api.telegram.org/bot{token}/sendMessage", data={"chat_id": chat, "text": text},
                  timeout=20).raise_for_status()


def signals(df: pd.DataFrame, s: dict, pair: str) -> list[tuple[str, float, float, float]]:
    return [(side, *levels(df, s, pair, side))
            for side, conds in (("LONG", s["long_when"]), ("SHORT", s["short_when"])) if all_met(df, conds)]


def main():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    for path in sorted((HERE / "strategies").glob("*.json")):
        s = json.loads(path.read_text())
        if s.get("type") == "ai":
            continue  # handled once a day by daily.py
        for pair in s["pairs"]:
            key = f"{path.stem}|{pair}"
            try:
                df = add_indicators(candles(pair, s["timeframe"]), s["indicators"])
                bar = str(df["time"].iloc[-1])
                if state.get(key) == bar:
                    continue  # this candle was already checked
                for side, entry, sl, tp in signals(df, s, pair):
                    notify(f"{side} {pair} ({s['timeframe']})\nStrategy: {s['name']}\n"
                           f"Entry ~{entry}\nSL {sl}\nTP {tp}\nCandle: {bar}")
                state[key] = bar  # only after notify succeeded, so a failed send retries next run
            except Exception as e:  # one bad pair/strategy must not stop the rest
                print(f"{key}: {e!r}")
    STATE.write_text(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()
