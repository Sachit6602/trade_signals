# forex-signals

YouTube strategy video → saved rules → Telegram alert when a closed candle matches.

```
extract.py  (once per video, on your PC)   →  strategies/*.json
scan.py     (cron on VPS, every 5 min)     →  OANDA candles → rules → Telegram
```

Claude is only called by `extract.py`. The scanner is plain pandas: free, fast, deterministic.

## Keys

- **OANDA**: free practice account → My Account → Manage API Access → generate token.
- **Telegram**: message `@BotFather` → `/newbot` → token. Send your bot any message, then open
  `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id`.
- **Anthropic**: console.anthropic.com → API key.

Copy `.env.example` to `.env` and fill it in.

## Web UI (easiest)

```bash
pip install -r requirements.txt
python app.py        # reads .env itself, then open http://127.0.0.1:8000
```

Paste a YouTube link → review rules and assumptions → Save. Edit/delete strategies, preview current
signals ("Check now", no Telegram), or run the scanner once. Local only; the VPS cron below is still what alerts you 24/7.

## Add a strategy from the command line

YouTube usually blocks transcript requests from cloud/VPS IPs, so do this step locally.

```bash
pip install -r requirements.txt
set -a; . ./.env; set +a          # PowerShell: set the vars with $env:NAME="..."
python extract.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

It prints the rules and the **assumptions** Claude had to make. Read those, then answer `y` to save.
If the video is discretionary (chart patterns by eye, trendlines, "feel"), it refuses instead of inventing rules.
No captions on the video? Save a transcript to a text file and use `--transcript file.txt`.

Edit the JSON by hand any time (pairs, periods, RR). Delete the file to stop a strategy.

## Deploy the scanner (VPS)

```bash
git clone <this repo> ~/forex-signals && cd ~/forex-signals
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
nano .env
scp strategies/*.json vps:~/forex-signals/strategies/    # from your PC
crontab -e
```

```
*/5 * * * * cd ~/forex-signals && set -a && . ./.env && set +a && .venv/bin/python scan.py >> scan.log 2>&1
```

Each candle is checked once (`state.json`). Errors go to `scan.log`.

### Chart-reading (AI) strategies, once a day

For discretionary methods (swing points, fair value gaps, order blocks) that can't be written as rules:
in the web UI, fill "describe a chart-reading strategy" with the method in plain words. After each daily close,
`daily.py` sends Claude the W/D/H1/M15 candles plus the method and posts the next day's bias, points of
interest and plan to Telegram (one Claude call per pair, ~$0.08 on Opus). Change candle counts per strategy with
`"timeframes": {"W": 26, "D": 60, "H1": 120, "M5": 144}` in its JSON.

OANDA's daily candle closes 17:00 New York, so:

```
CRON_TZ=America/New_York
7 17 * * 1-5 cd ~/forex-signals && set -a && . ./.env && set +a && .venv/bin/python daily.py >> daily.log 2>&1
```

It's a daily bias + plan, not a live entry: the lower-timeframe confirmation happens during the next day.

## Test

```bash
pip install pytest && pytest -q
```

## Limits

- One timeframe per strategy (no "H4 trend + M15 entry" yet).
- Alerts fire on candle close; entry price is that close, not the live price.
- Signals are not backtested. Paper-trade a strategy on the practice account before risking money.
