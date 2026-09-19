"""One-time: YouTube strategy video -> strategies/<name>.json

Usage: python extract.py <youtube-url> [--transcript file.txt]
"""
import json
import os
import re
import sys
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qs, urlparse

import anthropic
import requests
from pydantic import BaseModel

from scan import check_strategy_valid


class Indicator(BaseModel):
    name: str  # column name used in conditions, e.g. "ema50"
    type: Literal["ema", "sma", "rsi", "atr", "macd", "bbands", "highest", "lowest"]
    source: Literal["open", "high", "low", "close"]
    period: int
    period2: int  # macd slow; else 0
    period3: int  # macd signal; else 0
    std: float  # bbands deviation; else 0


class Condition(BaseModel):
    left: str
    op: Literal[">", "<", ">=", "<=", "crosses_above", "crosses_below"]
    right: str


class Strategy(BaseModel):
    codifiable: bool
    not_codifiable_reason: str
    name: str
    summary: str
    pairs: list[str]
    timeframe: Literal["M5", "M15", "M30", "H1", "H4", "D"]
    indicators: list[Indicator]
    long_when: list[Condition]
    short_when: list[Condition]
    stop_loss: Literal["atr", "pips", "swing"]
    stop_value: float
    take_profit_rr: float
    assumptions: list[str]


PROMPT = """Convert the forex trading strategy in this YouTube transcript into mechanical rules.

Columns available in conditions: open, high, low, close, hour (UTC, 0-23), and every indicator `name` you define.
Append [n] to reference n bars ago (e.g. "high[1]" = previous candle high). `right` may also be a number.
All conditions in a list must be true on the last closed candle (AND).

Indicator outputs:
- ema/sma/rsi/atr/highest/lowest -> column `name` (atr ignores source; highest/lowest = rolling max/min of source over period)
- macd -> `name`, `name_signal`, `name_hist` (period=fast, period2=slow, period3=signal)
- bbands -> `name_upper`, `name_mid`, `name_lower` (period, std)
Unused numeric fields = 0.

Stop loss: "atr" (stop_value x ATR14), "pips" (stop_value pips), "swing" (lowest low / highest high of last stop_value bars).
Pairs in OANDA format, e.g. EUR_USD, XAU_USD. If the video names none, use EUR_USD, GBP_USD, USD_JPY.

If the strategy depends on discretion that cannot be expressed this way (reading chart patterns by eye, news, "feel",
drawn trendlines), set codifiable=false and explain. Do not invent rules the video does not support.
List every guess you had to make (default periods, timeframe, etc.) in `assumptions`.

<transcript>
{transcript}
</transcript>"""


def video_id(url: str) -> str:
    u = urlparse(url)
    if u.hostname and u.hostname.endswith("youtu.be"):
        return u.path.lstrip("/")
    if "/shorts/" in u.path or "/live/" in u.path:
        return u.path.rstrip("/").split("/")[-1]
    return parse_qs(u.query)["v"][0]


def get_transcript(url: str) -> str:
    from youtube_transcript_api import YouTubeTranscriptApi

    fetched = YouTubeTranscriptApi().fetch(video_id(url), languages=["en", "hi"])
    return " ".join(s.text for s in fetched)


def ask_openrouter(prompt: str, model: type[BaseModel]):
    schema = model.model_json_schema()
    for obj in [schema, *schema.get("$defs", {}).values()]:
        obj["additionalProperties"] = False  # strict mode requires it
    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"},
        json={
            "model": os.environ.get("OPENROUTER_MODEL", "anthropic/claude-opus-5"),
            "max_tokens": 16000,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_schema",
                                "json_schema": {"name": model.__name__.lower(), "strict": True, "schema": schema}},
        },
        timeout=300,
    )
    if not r.ok:
        raise RuntimeError(f"OpenRouter {r.status_code}: {r.text[:500]}")
    return model.model_validate_json(r.json()["choices"][0]["message"]["content"])


def ask(prompt: str, model: type[BaseModel]):
    """Claude with structured output: direct Anthropic key if set, else OpenRouter."""
    if os.environ.get("OPENROUTER_API_KEY") and not os.environ.get("ANTHROPIC_API_KEY"):
        return ask_openrouter(prompt, model)
    response = anthropic.Anthropic().beta.messages.parse(
        model="claude-opus-5",
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": prompt}],
        output_format=model,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude declined the request.")
    return response.parsed_output


def extract(transcript: str) -> Strategy:
    return ask(PROMPT.format(transcript=transcript), Strategy)


def save(strategy: dict, source: str) -> Path:
    if strategy.get("type") != "ai":  # ai strategies have no mechanical rules to validate
        check_strategy_valid(strategy)  # raises if a condition references an unknown column
    out = Path(__file__).parent / "strategies" / (re.sub(r"\W+", "_", strategy["name"]).strip("_").lower() + ".json")
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({**strategy, "source": source}, indent=2))
    return out


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if "--transcript" in args:
        transcript = Path(args[args.index("--transcript") + 1]).read_text(encoding="utf-8")
    else:
        transcript = get_transcript(args[0])

    try:
        s = extract(transcript).model_dump()
    except RuntimeError as e:
        sys.exit(str(e))

    print(json.dumps(s, indent=2))
    if not s["codifiable"]:
        sys.exit(f"\nNot codifiable: {s['not_codifiable_reason']}")
    check_strategy_valid(s)

    if input("\nSave this strategy? [y/N] ").strip().lower() != "y":
        sys.exit("Not saved.")
    print(f"Saved {save(s, args[0])}")


if __name__ == "__main__":
    main()
