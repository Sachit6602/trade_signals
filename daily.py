"""Run once a day, just after the daily candle closes (OANDA: 17:00 New York).
For every strategy with "type": "ai", Claude reads the candles using the strategy's written method."""
import json
from typing import Literal

import pandas as pd
from pydantic import BaseModel

from extract import ask
from scan import HERE, candles, notify

STATE = HERE / "daily_state.json"  # separate from scan.py's state.json so the two cron jobs never overwrite each other

DEFAULT_TIMEFRAMES = {"W": 26, "D": 60, "H1": 120, "M15": 96}  # granularity -> closed candles sent to Claude


class Analysis(BaseModel):
    bias: Literal["bullish", "bearish", "none"]
    confidence: int  # 0-100 bias confidence, scored with the rubric in PROMPT
    swing_formed: bool  # entry checklist, usually false at the close; entry_ready needs all three
    cisd_formed: bool
    ltf_continuation: bool
    bias_reason: str
    weekly_context: str
    points_of_interest: list[str]  # e.g. "H1 fair value gap 1.0842-1.0851"
    draw_on_liquidity: str
    setup: Literal["none", "watch", "entry_ready"]
    plan: str  # what confirmation to wait for tomorrow, on which timeframe
    entry: float  # 0 unless entry_ready
    stop: float
    target: float


class Answer(BaseModel):
    answer: str  # free text, for follow-up questions about an analysis


PROMPT = """You are applying a trader's method to {pair}. The daily candle just closed; this runs once per day.
Follow ONLY the method below. Do not add concepts it doesn't use. If structure is messy, consolidating,
or timeframes don't align, say so: bias "none" or setup "none". Never force a trade.

<method>
{method}
</method>

Facts computed from the data (trust these over your own arithmetic):
- Last closed daily candle: {last}
- Previous day high {pdh}, previous day low {pdl}
- Daily closure type: {closure}

Your job:
1. Daily bias for the next day, with the reason, and the weekly context.
2. Points of interest (fair value gaps, swing highs/lows) with exact price levels and timeframe.
3. Draw on liquidity (target).
4. setup: "watch" = bias exists, wait for confirmation during the next day (describe exactly what in `plan`);
   "entry_ready" = the method's entry has ALREADY formed on the lower timeframe at this close
   (then fill entry, stop, target at 2R unless the method says otherwise); otherwise "none".
   entry/stop/target are 0 unless entry_ready.
5. confidence: integer 0-100 for the BIAS only, from what is knowable at the daily close. Add the points; do not guess:
   daily closure quality (clean full body in the bias direction, not a doji) up to 35,
   weekly context agrees with the bias up to 30,
   clear point of interest in the previous day's range with room to the draw on liquidity up to 35.
   Do NOT reduce confidence because the entry hasn't confirmed yet; that is tracked separately below.
   bias "none" means confidence below 40.
6. Entry checklist, true only if it has ALREADY formed in the data at the POI, in the bias direction:
   swing_formed (candle 2/3 closure swing point on the structure timeframe), cisd_formed (change in the state
   of delivery confirming it), ltf_continuation (continuation order block on the lower timeframe).
   setup "entry_ready" requires all three.

Closed candles (time UTC, OHLC mid prices):
{candles}"""


def daily_closure(d: pd.DataFrame) -> str:
    prev, last = d.iloc[-2], d.iloc[-1]
    if last.close > prev.high:
        return "bullish continuation (closed above previous day high)"
    if last.close < prev.low:
        return "bearish continuation (closed below previous day low)"
    swept_low, swept_high = last.low < prev.low, last.high > prev.high
    if swept_low and swept_high:
        return "swept both previous day high and low, closed inside range (no clear closure bias)"
    if swept_low:
        return "bullish reversal (swept previous day low, closed back above it)"
    if swept_high:
        return "bearish reversal (swept previous day high, closed back below it)"
    return "inside day (no closure bias)"


def build_prompt(s: dict, pair: str) -> tuple[str, str]:
    """The analysis prompt (method + candles) and the last daily bar. Follow-up questions reuse it."""
    frames = {tf: candles(pair, tf, n + 1).tail(n).round(5)
              for tf, n in {**DEFAULT_TIMEFRAMES, **s.get("timeframes", {})}.items()}
    d = frames["D"]
    prompt = PROMPT.format(
        pair=pair, method=s["method"], last=d.iloc[-1][["time", "open", "high", "low", "close"]].to_dict(),
        pdh=d["high"].iloc[-2], pdl=d["low"].iloc[-2], closure=daily_closure(d),
        candles="\n".join(f"<{tf}>\n{df[['time', 'open', 'high', 'low', 'close']].to_csv(index=False)}</{tf}>"
                          for tf, df in frames.items()),
    )
    return prompt, str(d["time"].iloc[-1])


def analyze(s: dict, pair: str) -> tuple[Analysis, str]:
    prompt, bar = build_prompt(s, pair)
    a = ask(prompt, Analysis)
    a.confidence = max(0, min(100, a.confidence))  # schema can't enforce the range
    if a.setup == "entry_ready" and not (a.swing_formed and a.cisd_formed and a.ltf_continuation):
        a.setup = "watch"  # model contradicted its own checklist; don't signal an entry
    return a, bar


def followup(s: dict, pair: str, analysis: dict, history: list[dict], question: str) -> str:
    """Answer a question about an analysis, with the same candles and method in front of Claude again."""
    # ponytail: each question re-sends the whole candle set (~one analysis in cost); add prompt caching if that stings
    prompt, _ = build_prompt(s, pair)
    qa = "".join(f"\n\nQ: {h['q']}\nA: {h['a']}" for h in history)
    return ask(
        f"{prompt}\n\nYou already answered:\n{json.dumps(analysis, indent=2)}{qa}"
        f"\n\nThe trader now asks:\n{question}\n\n"
        "Answer in plain text from the method and candles above, quoting exact price levels where they matter. "
        "Stay inside the method; if the data cannot answer it, say so instead of guessing.", Answer).answer


def message(s: dict, pair: str, a: Analysis, bar: str) -> str:
    lines = [f"{pair} daily bias: {a.bias.upper()} ({a.confidence}% confidence)", f"Strategy: {s['name']}",
             f"Why: {a.bias_reason}", f"Weekly: {a.weekly_context}",
             "POIs:\n" + "\n".join(f"- {p}" for p in a.points_of_interest),
             f"Draw on liquidity: {a.draw_on_liquidity}", f"Setup: {a.setup}",
             "Entry checklist: " + " ".join(f"{'✅' if ok else '⬜'} {name}" for name, ok in
                                            (("swing", a.swing_formed), ("CISD", a.cisd_formed), ("LTF continuation", a.ltf_continuation))),
             f"Plan: {a.plan}"]
    if a.setup == "entry_ready":
        lines.append(f"Entry {a.entry} | SL {a.stop} | TP {a.target}")
    return "\n".join(lines + [f"Daily candle: {bar}"])


def main():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    for path in sorted((HERE / "strategies").glob("*.json")):
        s = json.loads(path.read_text())
        if s.get("type") != "ai":
            continue
        for pair in s["pairs"]:
            key = f"{path.stem}|{pair}|daily"
            try:
                if state.get(key) == str(candles(pair, "D", 2)["time"].iloc[-1]):
                    continue  # already analyzed this daily candle; skip the Claude call
                a, bar = analyze(s, pair)
                if a.bias != "none":
                    notify(message(s, pair, a, bar))
                state[key] = bar
            except Exception as e:  # one bad pair must not stop the rest
                print(f"{key}: {e!r}")
    STATE.write_text(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()
