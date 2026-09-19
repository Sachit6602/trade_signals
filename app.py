"""Local web UI: python app.py -> http://127.0.0.1:8000  (frontend lives in ui.html)"""
import contextlib
import io
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).parent
STRATEGIES = HERE / "strategies"
KEYS = ["ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "OANDA_TOKEN", "TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID"]

if (HERE / ".env").exists():  # load .env so you don't have to export vars by hand
    for line in (HERE / ".env").read_text().splitlines():
        k, sep, v = line.partition("=")
        if sep and not k.strip().startswith("#") and v.strip():
            os.environ.setdefault(k.strip(), v.strip().strip('"'))

import daily  # noqa: E402  (after .env so the Anthropic client sees the key)
import extract  # noqa: E402
import scan  # noqa: E402


def strategy_path(file: str) -> Path:
    p = STRATEGIES / file
    if p.parent != STRATEGIES or p.suffix != ".json":  # no ../ tricks
        raise ValueError(f"bad file name: {file!r}")
    return p


def api(route: str, body: dict):
    if route == "status":
        return {k: bool(os.environ.get(k)) for k in KEYS}
    if route == "strategies":
        return [{"file": p.name, **json.loads(p.read_text())} for p in sorted(STRATEGIES.glob("*.json"))]
    if route == "extract":
        transcript = body.get("transcript", "").strip() or extract.get_transcript(body["url"])
        return {"strategy": extract.extract(transcript).model_dump(), "transcript": transcript}
    if route == "save":
        s = body["strategy"]
        out = extract.save(s, s.get("source") or body.get("url", ""))
        if body.get("file") and strategy_path(body["file"]) != out:  # renamed while editing
            strategy_path(body["file"]).unlink(missing_ok=True)
        return {"file": out.name}
    if route == "delete":
        strategy_path(body["file"]).unlink(missing_ok=True)
        return {}
    if route == "check":  # dry run: current signals, no Telegram, no state.json
        rows = []
        for p in sorted(STRATEGIES.glob("*.json")):
            s = json.loads(p.read_text())
            if s.get("type") == "ai":
                continue
            for pair in s["pairs"]:
                row = {"strategy": s["name"], "pair": pair, "timeframe": s["timeframe"]}
                try:
                    df = scan.add_indicators(scan.candles(pair, s["timeframe"]), s["indicators"])
                    row.update(candle=str(df["time"].iloc[-1]), close=float(df["close"].iloc[-1]),
                               signals=[dict(zip(["side", "entry", "sl", "tp"], x)) for x in scan.signals(df, s, pair)])
                except Exception as e:
                    row["error"] = repr(e)
                rows.append(row)
        return rows
    if route == "daily":  # one pair per request so the page can run pairs in parallel; no Telegram, no state
        s = json.loads(strategy_path(body["file"]).read_text())
        a, bar = daily.analyze(s, body["pair"])
        return {"bar": bar, "analysis": a.model_dump(), "message": daily.message(s, body["pair"], a, bar)}
    if route == "candles":  # chart data for the result cards; OANDA only, no Claude
        tf = body.get("tf", "H1")
        if tf not in ("M15", "H1", "H4", "D"):
            raise ValueError(f"bad timeframe: {tf!r}")
        df = scan.candles(body["pair"], tf, min(int(body.get("count", 80)), 300))
        return [[t.isoformat(), o, h, l, c] for t, o, h, l, c in df[["time", "open", "high", "low", "close"]].itertuples(index=False)]
    if route in ("scan", "daily_run"):  # the real cron jobs, once
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            (scan if route == "scan" else daily).main()
        return {"log": buf.getvalue() or "Done. Any new signals were sent to Telegram."}
    raise KeyError(route)


class Handler(BaseHTTPRequestHandler):
    def send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.send(200, (HERE / "ui.html").read_bytes(), "text/html; charset=utf-8")  # read each time: edit, refresh

    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or "{}")
            self.send(200, json.dumps(api(self.path.removeprefix("/api/"), body)).encode(), "application/json")
        except Exception as e:
            self.send(400, json.dumps({"error": f"{type(e).__name__}: {e}"}).encode(), "application/json")


if __name__ == "__main__":
    print("Open http://127.0.0.1:8000")
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
