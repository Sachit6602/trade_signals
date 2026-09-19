function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useEffect,
  useCallback
} = React;
const {
  motion,
  AnimatePresence,
  LayoutGroup
} = Motion;
const spring = {
  type: "spring",
  stiffness: 420,
  damping: 34
};
const COST_PER_PAIR = 0.12;
const COMMON_PAIRS = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CAD", "USD_CHF", "NZD_USD", "EUR_JPY", "GBP_JPY", "XAU_USD"];
const KEY_LABEL = {
  ANTHROPIC_API_KEY: "Anthropic",
  OPENROUTER_API_KEY: "OpenRouter",
  OANDA_TOKEN: "OANDA",
  TELEGRAM_TOKEN: "Telegram bot",
  TELEGRAM_CHAT_ID: "Telegram chat"
};
const SETUP = {
  none: "No setup",
  watch: "Watch",
  entry_ready: "Entry ready"
};
async function api(route, body = {}) {
  const r = await fetch("/api/" + route, {
    method: "POST",
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
const store = {
  get(k, fallback) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  }
};
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
const ago = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
};
// OANDA stamps daily candles with their open time; show the day they closed instead
const closedOn = bar => new Date(new Date(bar.replace(" ", "T")).getTime() + 864e5).toLocaleDateString(undefined, {
  month: "short",
  day: "numeric"
});
const pretty = p => p.replace("_", "/");
// +1 = trade idea makes USD stronger, -1 weaker, 0 = no USD in pair or no bias
const usdDir = (pair, bias) => {
  if (bias === "none") return 0;
  const [base, quote] = pair.split("_"),
    up = bias === "bullish" ? 1 : -1;
  return quote === "USD" ? -up : base === "USD" ? up : 0;
};
const Btn = props => /*#__PURE__*/React.createElement(motion.button, _extends({
  whileHover: props.disabled ? {} : {
    y: -1
  },
  whileTap: props.disabled ? {} : {
    scale: 0.96
  }
}, props));
const Fade = ({
  children,
  ...p
}) => /*#__PURE__*/React.createElement(motion.div, _extends({
  initial: {
    opacity: 0,
    y: 10
  },
  animate: {
    opacity: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    y: -6
  },
  transition: {
    duration: 0.2
  }
}, p), children);
const Collapse = ({
  open,
  children
}) => /*#__PURE__*/React.createElement(AnimatePresence, {
  initial: false
}, open && /*#__PURE__*/React.createElement(motion.div, {
  initial: {
    height: 0,
    opacity: 0
  },
  animate: {
    height: "auto",
    opacity: 1
  },
  exit: {
    height: 0,
    opacity: 0
  },
  transition: {
    duration: 0.25
  },
  style: {
    overflow: "hidden"
  }
}, children));
function Modal({
  open,
  onClose,
  wide,
  children
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return /*#__PURE__*/React.createElement(AnimatePresence, null, open && /*#__PURE__*/React.createElement(motion.div, {
    className: "backdrop",
    onClick: onClose,
    initial: {
      opacity: 0
    },
    animate: {
      opacity: 1
    },
    exit: {
      opacity: 0
    }
  }, /*#__PURE__*/React.createElement(motion.div, {
    className: `modal ${wide ? "wide" : ""}`,
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true",
    initial: {
      opacity: 0,
      y: 30,
      scale: 0.96
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1
    },
    exit: {
      opacity: 0,
      y: 20,
      scale: 0.96
    },
    transition: spring
  }, children)));
}
function useConfirm() {
  const [state, setState] = useState({
    open: false
  });
  const ask = (title, body, danger) => new Promise(resolve => setState({
    open: true,
    title,
    body,
    danger,
    resolve
  }));
  const close = ok => {
    state.resolve?.(ok);
    setState(s => ({
      ...s,
      open: false
    }));
  };
  const element = /*#__PURE__*/React.createElement(Modal, {
    open: state.open,
    onClose: () => close(false)
  }, /*#__PURE__*/React.createElement("h3", null, state.title), /*#__PURE__*/React.createElement("p", {
    className: "dim"
  }, state.body), /*#__PURE__*/React.createElement("div", {
    className: "row end"
  }, /*#__PURE__*/React.createElement(Btn, {
    className: "ghost",
    onClick: () => close(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    className: state.danger ? "danger" : "",
    onClick: () => close(true),
    autoFocus: true
  }, "Confirm")));
  return [element, ask];
}
function Toasts({
  items
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "toasts",
    "aria-live": "polite"
  }, /*#__PURE__*/React.createElement(AnimatePresence, null, items.map(t => /*#__PURE__*/React.createElement(motion.div, {
    key: t.id,
    layout: true,
    className: `toast ${t.kind}`,
    transition: spring,
    initial: {
      opacity: 0,
      y: 20,
      scale: 0.95
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1
    },
    exit: {
      opacity: 0,
      x: 40
    }
  }, t.text))));
}
function Segmented({
  value,
  onChange,
  options,
  id
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: id === "tabs" ? "tabs" : "seg",
    role: "tablist"
  }, options.map(([key, label, count]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    role: "tab",
    "aria-selected": value === key,
    className: `tab ${value === key ? "active" : ""}`,
    onClick: () => onChange(key)
  }, value === key && /*#__PURE__*/React.createElement(motion.span, {
    layoutId: id + "-pill",
    className: "tabpill",
    transition: spring
  }), /*#__PURE__*/React.createElement("span", {
    className: "tablabel"
  }, label, count != null && /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, count)))));
}
function KeyPills({
  keys
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "row wrap gap"
  }, Object.entries(keys).map(([k, ok], i) => /*#__PURE__*/React.createElement(motion.span, {
    key: k,
    className: `pill ${ok ? "ok" : "no"}`,
    title: ok ? "Set in .env" : "Missing in .env (restart the app after adding it)",
    initial: {
      opacity: 0,
      y: -6
    },
    animate: {
      opacity: 1,
      y: 0
    },
    transition: {
      delay: i * 0.05
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), " ", KEY_LABEL[k] || k)));
}
function PairInput({
  pairs,
  setPairs
}) {
  const [text, setText] = useState("");
  const add = raw => {
    const p = raw.trim().toUpperCase().replace("/", "_");
    if (/^[A-Z0-9]{3,6}_[A-Z0-9]{3,6}$/.test(p) && !pairs.includes(p)) setPairs([...pairs, p]);
    setText("");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "stack",
    style: {
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pairchips"
  }, /*#__PURE__*/React.createElement(AnimatePresence, null, pairs.map(p => /*#__PURE__*/React.createElement(motion.span, {
    key: p,
    layout: true,
    className: "chip",
    initial: {
      scale: 0.6,
      opacity: 0
    },
    animate: {
      scale: 1,
      opacity: 1
    },
    exit: {
      scale: 0.6,
      opacity: 0
    }
  }, pretty(p), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "x",
    "aria-label": `Remove ${p}`,
    onClick: () => setPairs(pairs.filter(x => x !== p))
  }, "\xD7")))), /*#__PURE__*/React.createElement("input", {
    value: text,
    placeholder: "Type a pair, press Enter",
    onChange: e => setText(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        add(text);
      }
      if (e.key === "Backspace" && !text && pairs.length) setPairs(pairs.slice(0, -1));
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "row wrap gap"
  }, COMMON_PAIRS.filter(p => !pairs.includes(p)).map(p => /*#__PURE__*/React.createElement(motion.button, {
    key: p,
    type: "button",
    className: "sugg",
    whileHover: {
      y: -1
    },
    whileTap: {
      scale: 0.94
    },
    onClick: () => add(p)
  }, "+ ", pretty(p)))));
}
function AiForm({
  initial = {},
  file,
  onSaved,
  toast
}) {
  const [name, setName] = useState(initial.name || "");
  const [pairs, setPairs] = useState(initial.pairs || ["EUR_USD", "GBP_USD", "USD_JPY"]);
  const [method, setMethod] = useState(initial.method || "");
  const [busy, setBusy] = useState(false);
  const ready = name.trim() && pairs.length && method.trim();
  const save = async () => {
    setBusy(true);
    try {
      const {
        file: _,
        ...rest
      } = initial;
      await api("save", {
        strategy: {
          ...rest,
          type: "ai",
          name: name.trim(),
          pairs,
          method: method.trim()
        },
        file
      });
      toast(`Saved “${name.trim()}”`, "ok");
      onSaved();
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("label", {
    className: "f"
  }, "Name", /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Fractal model"
  })), /*#__PURE__*/React.createElement("label", {
    className: "f"
  }, "Pairs", /*#__PURE__*/React.createElement(PairInput, {
    pairs: pairs,
    setPairs: setPairs
  })), /*#__PURE__*/React.createElement("label", {
    className: "f"
  }, "Method (plain words or a transcript) ", /*#__PURE__*/React.createElement("span", null, method.length.toLocaleString(), " chars"), /*#__PURE__*/React.createElement("textarea", {
    rows: 12,
    value: method,
    onChange: e => setMethod(e.target.value),
    placeholder: "Explain the method step by step\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    className: "row end"
  }, /*#__PURE__*/React.createElement(Btn, {
    disabled: !ready || busy,
    onClick: save
  }, busy ? "Saving…" : "Save AI strategy")));
}
function JsonForm({
  initial,
  file,
  onSaved,
  toast
}) {
  const {
    file: _,
    ...rest
  } = initial;
  const [text, setText] = useState(JSON.stringify(rest, null, 2));
  const [busy, setBusy] = useState(false);
  let error = null;
  try {
    JSON.parse(text);
  } catch (e) {
    error = e.message;
  }
  const save = async () => {
    setBusy(true);
    try {
      await api("save", {
        strategy: JSON.parse(text),
        file
      });
      toast("Saved", "ok");
      onSaved();
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: 20,
    value: text,
    onChange: e => setText(e.target.value),
    spellCheck: false
  }), /*#__PURE__*/React.createElement("div", {
    className: "row between"
  }, /*#__PURE__*/React.createElement("span", {
    className: error ? "err small" : "dim small"
  }, error ? `Invalid JSON: ${error}` : "Rules are validated on save."), /*#__PURE__*/React.createElement(Btn, {
    disabled: !!error || busy,
    onClick: save
  }, busy ? "Saving…" : "Save")));
}

/* ---------------- Daily analysis ---------------- */

function BiasBadge({
  bias
}) {
  return /*#__PURE__*/React.createElement(motion.span, {
    className: `badge ${bias}`,
    initial: {
      scale: 0.5,
      opacity: 0
    },
    animate: {
      scale: 1,
      opacity: 1
    },
    transition: {
      ...spring,
      delay: 0.1
    }
  }, bias === "bullish" ? "▲" : bias === "bearish" ? "▼" : "•", " ", bias.toUpperCase());
}
function Confidence({
  value
}) {
  const pct = typeof value === "number" ? value : {
    low: 30,
    medium: 60,
    high: 85
  }[value] ?? 0; // older saved results used words
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const controls = Motion.animate(0, pct, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: v => setShown(Math.round(v))
    });
    return () => controls.stop();
  }, [pct]);
  const color = pct >= 70 ? "var(--long)" : pct >= 40 ? "var(--warn)" : "var(--short)";
  const r = 22,
    c = 2 * Math.PI * r;
  return /*#__PURE__*/React.createElement("div", {
    className: "row gap",
    title: "Bias confidence from what's known at the daily close: closure quality 35, weekly agreement 30, point of interest 35"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "56",
    height: "56",
    viewBox: "0 0 56 56",
    "aria-label": `${pct}% confidence`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "28",
    cy: "28",
    r: r,
    fill: "none",
    stroke: "var(--panel2)",
    strokeWidth: "5"
  }), /*#__PURE__*/React.createElement(motion.circle, {
    cx: "28",
    cy: "28",
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: "5",
    strokeLinecap: "round",
    strokeDasharray: c,
    transform: "rotate(-90 28 28)",
    initial: {
      strokeDashoffset: c
    },
    animate: {
      strokeDashoffset: c * (1 - pct / 100)
    },
    transition: {
      duration: 0.9,
      ease: "easeOut"
    }
  }), /*#__PURE__*/React.createElement("text", {
    x: "28",
    y: "32",
    textAnchor: "middle",
    fontSize: "13",
    fontWeight: "650",
    fill: "var(--text)"
  }, shown, "%")), /*#__PURE__*/React.createElement("div", {
    className: "small"
  }, /*#__PURE__*/React.createElement("div", null, "Bias confidence"), /*#__PURE__*/React.createElement("div", {
    className: "dim"
  }, pct >= 70 ? "Strong" : pct >= 40 ? "Moderate" : "Weak — stand aside")));
}
function EntryChecklist({
  a
}) {
  if (a.swing_formed === undefined) return null; // result saved before the checklist existed
  const steps = [["Swing point", a.swing_formed], ["CISD", a.cisd_formed], ["LTF continuation", a.ltf_continuation]];
  const done = steps.filter(([, ok]) => ok).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "check"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row between small"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "Entry confirmation"), /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, done, "/3")), /*#__PURE__*/React.createElement("div", {
    className: "steps"
  }, steps.map(([label, ok], i) => /*#__PURE__*/React.createElement(motion.div, {
    key: label,
    className: `step ${ok ? "on" : ""}`,
    initial: {
      opacity: 0,
      y: 6
    },
    animate: {
      opacity: 1,
      y: 0
    },
    transition: {
      delay: 0.2 + i * 0.1
    }
  }, /*#__PURE__*/React.createElement(motion.span, {
    className: "box",
    initial: {
      scale: 0.4
    },
    animate: {
      scale: 1
    },
    transition: {
      ...spring,
      delay: 0.3 + i * 0.1
    }
  }, ok ? "✓" : ""), label))), done < 3 && /*#__PURE__*/React.createElement("div", {
    className: "dim small"
  }, "Not confirmed yet: wait for these during the next session."));
}
function PairCard({
  pair,
  r,
  now,
  onRun,
  toast
}) {
  const [open, setOpen] = useState(false);
  const a = r?.analysis,
    status = r?.status || "idle";
  const expected = 110_000; // ~observed Claude reasoning time per pair
  return /*#__PURE__*/React.createElement(motion.div, {
    layout: true,
    transition: spring,
    className: `card pcard ${status === "done" ? a.bias : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "row between gap"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pair"
  }, pretty(pair)), /*#__PURE__*/React.createElement("div", {
    className: "dim small"
  }, status === "done" && `${closedOn(r.bar)} close · analyzed ${ago(now - r.at)} ago`, status === "loading" && `Reading candles… ${ago(now - r.started)}`, status === "error" && "Failed", status === "idle" && "Not analyzed yet")), status === "done" && /*#__PURE__*/React.createElement(BiasBadge, {
    bias: a.bias
  })), /*#__PURE__*/React.createElement(AnimatePresence, {
    mode: "wait",
    initial: false
  }, status === "loading" && /*#__PURE__*/React.createElement(Fade, {
    key: "loading"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement(motion.div, {
    initial: {
      width: 0
    },
    animate: {
      width: `${Math.min(95, (now - r.started) / expected * 100)}%`
    },
    transition: {
      duration: 1,
      ease: "linear"
    }
  })), [90, 70, 80].map((w, i) => /*#__PURE__*/React.createElement(motion.div, {
    key: i,
    className: "shimmer",
    style: {
      width: `${w}%`
    },
    animate: {
      backgroundPosition: ["200% 0", "-200% 0"]
    },
    transition: {
      repeat: Infinity,
      duration: 1.6,
      ease: "linear",
      delay: i * 0.15
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "dim small"
  }, "Claude takes about two minutes per pair.")), status === "error" && /*#__PURE__*/React.createElement(Fade, {
    key: "error"
  }, /*#__PURE__*/React.createElement("p", {
    className: "err small"
  }, r.error)), status === "done" && /*#__PURE__*/React.createElement(Fade, {
    key: "done"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row wrap between gap",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Confidence, {
    value: a.confidence
  }), /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, SETUP[a.setup])), /*#__PURE__*/React.createElement(EntryChecklist, {
    a: a
  }), /*#__PURE__*/React.createElement("p", {
    className: "why"
  }, a.bias_reason), a.setup === "entry_ready" && /*#__PURE__*/React.createElement("div", {
    className: "levels"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, "Entry"), /*#__PURE__*/React.createElement("b", null, a.entry)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, "Stop"), /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--short)"
    }
  }, a.stop)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, "Target"), /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--long)"
    }
  }, a.target))), /*#__PURE__*/React.createElement("button", {
    className: "link",
    onClick: () => setOpen(!open),
    "aria-expanded": open
  }, open ? "Hide details" : "Plan, levels & context", " ", /*#__PURE__*/React.createElement(motion.span, {
    style: {
      display: "inline-block"
    },
    animate: {
      rotate: open ? 180 : 0
    }
  }, "\u25BE")), /*#__PURE__*/React.createElement(Collapse, {
    open: open
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Plan"), a.plan), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Points of interest"), /*#__PURE__*/React.createElement("ul", null, a.points_of_interest.map((p, i) => /*#__PURE__*/React.createElement(motion.li, {
    key: i,
    initial: {
      opacity: 0,
      x: -8
    },
    animate: {
      opacity: 1,
      x: 0
    },
    transition: {
      delay: i * 0.05
    }
  }, p)))), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Draw on liquidity"), a.draw_on_liquidity), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Weekly context"), a.weekly_context)))), /*#__PURE__*/React.createElement("div", {
    className: "row gap pfoot"
  }, /*#__PURE__*/React.createElement(Btn, {
    className: "ghost sm",
    disabled: status === "loading",
    onClick: onRun
  }, status === "idle" ? "Analyze" : status === "loading" ? "Running…" : "Re-run", " ", /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "~$", COST_PER_PAIR.toFixed(2))), status === "done" && /*#__PURE__*/React.createElement(Btn, {
    className: "ghost sm",
    onClick: () => navigator.clipboard.writeText(r.message).then(() => toast(`Copied ${pretty(pair)}`, "ok"))
  }, "Copy text")));
}
function UsdRead({
  pairs,
  results,
  keyOf
}) {
  const dirs = pairs.map(p => [p, results[keyOf(p)]]).filter(([, r]) => r?.status === "done").map(([p, r]) => [p, usdDir(p, r.analysis.bias)]).filter(([, d]) => d !== 0);
  if (dirs.length < 2) return null;
  const up = dirs.some(([, d]) => d > 0),
    down = dirs.some(([, d]) => d < 0);
  return /*#__PURE__*/React.createElement(motion.div, {
    layout: true,
    initial: {
      opacity: 0,
      y: -8
    },
    animate: {
      opacity: 1,
      y: 0
    },
    className: `usd ${up && down ? "mixed" : "aligned"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "row between wrap gap"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, up && down ? "Mixed dollar read" : up ? "Aligned: dollar stronger" : "Aligned: dollar weaker"), /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, " ", up && down ? " — the biases disagree on USD, so be selective and avoid doubling up." : " — the biases agree on USD.")), /*#__PURE__*/React.createElement("span", {
    className: "row wrap gap"
  }, dirs.map(([p, d]) => /*#__PURE__*/React.createElement("span", {
    key: p,
    className: `chip ${d > 0 ? "up" : "down"}`
  }, pretty(p), " \u2192 USD ", d > 0 ? "▲" : "▼")))));
}
function AnalysisTab({
  strategies,
  toast,
  goAdd
}) {
  const ai = strategies.filter(s => s.type === "ai");
  const [file, setFile] = useState(() => store.get("fx.aiFile", null));
  const [results, setResults] = useState(() => store.get("fx.results", {}));
  const now = useNow();
  useEffect(() => store.set("fx.results", Object.fromEntries(Object.entries(results).filter(([, r]) => r.status !== "loading"))), [results]);
  useEffect(() => store.set("fx.aiFile", file), [file]);
  if (!ai.length) return /*#__PURE__*/React.createElement(Fade, {
    className: "card empty"
  }, /*#__PURE__*/React.createElement("h3", null, "No AI strategies yet"), /*#__PURE__*/React.createElement("p", {
    className: "dim"
  }, "Describe a chart-reading method and Claude will read the candles once a day."), /*#__PURE__*/React.createElement(Btn, {
    onClick: goAdd
  }, "Add a strategy"));
  const s = ai.find(x => x.file === file) || ai[0];
  const keyOf = pair => `${s.file}|${pair}`;
  const run = pair => {
    const k = keyOf(pair);
    setResults(r => ({
      ...r,
      [k]: {
        status: "loading",
        started: Date.now()
      }
    }));
    api("daily", {
      file: s.file,
      pair
    }).then(d => {
      setResults(r => ({
        ...r,
        [k]: {
          status: "done",
          at: Date.now(),
          ...d
        }
      }));
      toast(`${pretty(pair)} ready: ${d.analysis.bias}`, "ok");
    }).catch(e => {
      setResults(r => ({
        ...r,
        [k]: {
          status: "error",
          at: Date.now(),
          error: e.message
        }
      }));
      toast(`${pretty(pair)}: ${e.message}`, "error");
    });
  };
  const idle = s.pairs.filter(p => results[keyOf(p)]?.status !== "loading");
  return /*#__PURE__*/React.createElement(Fade, {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card row between wrap gap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack",
    style: {
      gap: 4
    }
  }, ai.length > 1 ? /*#__PURE__*/React.createElement(Segmented, {
    id: "strat",
    value: s.file,
    onChange: setFile,
    options: ai.map(x => [x.file, x.name])
  }) : /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, "Preview only: nothing is sent to Telegram. Pairs run in parallel.")), /*#__PURE__*/React.createElement(Btn, {
    disabled: !idle.length,
    onClick: () => idle.forEach(run)
  }, "Analyze ", idle.length === s.pairs.length ? "all" : idle.length, " \xB7 ~$", (idle.length * COST_PER_PAIR).toFixed(2))), /*#__PURE__*/React.createElement(UsdRead, {
    pairs: s.pairs,
    results: results,
    keyOf: keyOf
  }), /*#__PURE__*/React.createElement(LayoutGroup, null, /*#__PURE__*/React.createElement("div", {
    className: "grid"
  }, s.pairs.map(p => /*#__PURE__*/React.createElement(PairCard, {
    key: keyOf(p),
    pair: p,
    r: results[keyOf(p)],
    now: now,
    onRun: () => run(p),
    toast: toast
  })))));
}

/* ---------------- Strategies ---------------- */

const Rules = ({
  conds
}) => conds.length ? conds.map((c, i) => /*#__PURE__*/React.createElement("code", {
  key: i,
  style: {
    marginRight: 6
  }
}, c.left, " ", c.op, " ", c.right)) : /*#__PURE__*/React.createElement("span", {
  className: "dim"
}, "none");
function StrategiesTab({
  strategies,
  reload,
  toast,
  confirm,
  goAdd
}) {
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const remove = async s => {
    if (!(await confirm(`Delete “${s.name}”?`, "Its JSON file is removed. This can't be undone.", true))) return;
    try {
      await api("delete", {
        file: s.file
      });
      toast(`Deleted “${s.name}”`, "ok");
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };
  if (!strategies.length) return /*#__PURE__*/React.createElement(Fade, {
    className: "card empty"
  }, /*#__PURE__*/React.createElement("h3", null, "No strategies saved"), /*#__PURE__*/React.createElement("p", {
    className: "dim"
  }, "Extract one from YouTube or describe your own."), /*#__PURE__*/React.createElement(Btn, {
    onClick: goAdd
  }, "Add a strategy"));
  return /*#__PURE__*/React.createElement(Fade, null, /*#__PURE__*/React.createElement(LayoutGroup, null, /*#__PURE__*/React.createElement("div", {
    className: "list"
  }, /*#__PURE__*/React.createElement(AnimatePresence, null, strategies.map((s, i) => {
    const open = expanded === s.file;
    return /*#__PURE__*/React.createElement(motion.div, {
      key: s.file,
      layout: true,
      className: "card clickable",
      onClick: () => setExpanded(open ? null : s.file),
      initial: {
        opacity: 0,
        y: 12
      },
      animate: {
        opacity: 1,
        y: 0,
        transition: {
          delay: i * 0.04
        }
      },
      exit: {
        opacity: 0,
        scale: 0.96
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "row between wrap gap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row wrap gap"
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 15
      }
    }, s.name), /*#__PURE__*/React.createElement("span", {
      className: "chip"
    }, s.type === "ai" ? "AI · once a day" : `Rules · ${s.timeframe}`), s.pairs.map(p => /*#__PURE__*/React.createElement("span", {
      key: p,
      className: "chip dim"
    }, pretty(p)))), /*#__PURE__*/React.createElement("div", {
      className: "row gap",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(Btn, {
      className: "ghost sm",
      onClick: () => setEditing(s)
    }, "Edit"), /*#__PURE__*/React.createElement(Btn, {
      className: "danger sm",
      onClick: () => remove(s)
    }, "Delete"))), !open && /*#__PURE__*/React.createElement("p", {
      className: "dim small clamp"
    }, s.type === "ai" ? s.method : s.summary), /*#__PURE__*/React.createElement(Collapse, {
      open: open
    }, s.type === "ai" ? /*#__PURE__*/React.createElement("pre", {
      className: "method"
    }, s.method) : /*#__PURE__*/React.createElement("div", {
      className: "stack",
      style: {
        gap: 6,
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, s.summary), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--long)"
      }
    }, "LONG"), " when ", /*#__PURE__*/React.createElement(Rules, {
      conds: s.long_when
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--short)"
      }
    }, "SHORT"), " when ", /*#__PURE__*/React.createElement(Rules, {
      conds: s.short_when
    })), /*#__PURE__*/React.createElement("div", {
      className: "dim small"
    }, "Stop ", s.stop_loss, " ", s.stop_value, " \xB7 Target ", s.take_profit_rr, "R", s.source && /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 ", /*#__PURE__*/React.createElement("a", {
      href: s.source,
      target: "_blank",
      rel: "noreferrer",
      style: {
        color: "var(--acc)"
      },
      onClick: e => e.stopPropagation()
    }, "source video"))))));
  })))), /*#__PURE__*/React.createElement(Modal, {
    open: !!editing,
    onClose: () => setEditing(null),
    wide: true
  }, editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h3", null, "Edit \u201C", editing.name, "\u201D"), editing.type === "ai" ? /*#__PURE__*/React.createElement(AiForm, {
    initial: editing,
    file: editing.file,
    toast: toast,
    onSaved: () => {
      setEditing(null);
      reload();
    }
  }) : /*#__PURE__*/React.createElement(JsonForm, {
    initial: editing,
    file: editing.file,
    toast: toast,
    onSaved: () => {
      setEditing(null);
      reload();
    }
  }))));
}

/* ---------------- Add ---------------- */

function AddTab({
  reload,
  toast,
  goStrategies
}) {
  const [mode, setMode] = useState("ai");
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [job, setJob] = useState(null); // {started} | {result}
  const [aiPrefill, setAiPrefill] = useState(null);
  const now = useNow();
  const extract = async () => {
    setJob({
      started: Date.now()
    });
    try {
      setJob({
        result: await api("extract", {
          url,
          transcript
        })
      });
    } catch (e) {
      setJob(null);
      toast(e.message, "error");
    }
  };
  const saved = () => {
    reload();
    goStrategies();
  };
  const res = job?.result,
    s = res?.strategy;
  return /*#__PURE__*/React.createElement(Fade, {
    className: "stack"
  }, /*#__PURE__*/React.createElement(Segmented, {
    id: "mode",
    value: mode,
    onChange: setMode,
    options: [["ai", "Describe it (AI reads charts daily)"], ["yt", "From a YouTube video (fixed rules)"]]
  }), /*#__PURE__*/React.createElement(AnimatePresence, {
    mode: "wait"
  }, mode === "ai" ? /*#__PURE__*/React.createElement(Fade, {
    key: "ai" + (aiPrefill ? 1 : 0),
    className: "card"
  }, /*#__PURE__*/React.createElement("p", {
    className: "dim",
    style: {
      marginTop: 0
    }
  }, "For discretionary methods (swing points, fair value gaps, order blocks). After each daily close, Claude reads Weekly, Daily, H1 and M15 candles using your description and returns the bias and plan."), /*#__PURE__*/React.createElement(AiForm, {
    initial: aiPrefill || {},
    toast: toast,
    onSaved: saved
  })) : /*#__PURE__*/React.createElement(Fade, {
    key: "yt",
    className: "card stack"
  }, /*#__PURE__*/React.createElement("label", {
    className: "f"
  }, "YouTube link", /*#__PURE__*/React.createElement("input", {
    value: url,
    onChange: e => setUrl(e.target.value),
    placeholder: "https://www.youtube.com/watch?v=\u2026"
  })), /*#__PURE__*/React.createElement("button", {
    className: "link",
    style: {
      justifySelf: "start"
    },
    onClick: () => setShowTranscript(!showTranscript)
  }, showTranscript ? "Hide transcript box" : "No captions? Paste the transcript"), /*#__PURE__*/React.createElement(Collapse, {
    open: showTranscript
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: 6,
    value: transcript,
    onChange: e => setTranscript(e.target.value),
    placeholder: "Transcript text"
  })), /*#__PURE__*/React.createElement("div", {
    className: "row gap wrap"
  }, /*#__PURE__*/React.createElement(Btn, {
    disabled: job?.started || !url.trim() && !transcript.trim(),
    onClick: extract
  }, job?.started ? `Asking Claude… ${ago(now - job.started)}` : "Extract rules with Claude"), job?.started && /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, "Usually 1\u20132 minutes.")), /*#__PURE__*/React.createElement(AnimatePresence, {
    mode: "wait"
  }, s && !s.codifiable && /*#__PURE__*/React.createElement(Fade, {
    key: "no",
    className: "card",
    style: {
      borderColor: "#f5b83d55"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: "var(--warn)"
    }
  }, "Can't be turned into fixed rules"), /*#__PURE__*/React.createElement("p", {
    className: "dim"
  }, s.not_codifiable_reason), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setAiPrefill({
        name: s.name,
        method: res.transcript
      });
      setMode("ai");
      setJob(null);
    }
  }, "Use it as an AI strategy instead")), s && s.codifiable && /*#__PURE__*/React.createElement(Fade, {
    key: "yes",
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row wrap gap"
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 15
    }
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, s.timeframe), s.pairs.map(p => /*#__PURE__*/React.createElement("span", {
    key: p,
    className: "chip dim"
  }, pretty(p)))), /*#__PURE__*/React.createElement("p", null, s.summary), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: "var(--warn)"
    }
  }, "Assumptions Claude made \u2014 read before saving"), /*#__PURE__*/React.createElement("ul", null, s.assumptions.map((a, i) => /*#__PURE__*/React.createElement(motion.li, {
    key: i,
    initial: {
      opacity: 0,
      x: -8
    },
    animate: {
      opacity: 1,
      x: 0
    },
    transition: {
      delay: i * 0.06
    }
  }, a))))), /*#__PURE__*/React.createElement(JsonForm, {
    initial: {
      ...s,
      source: url
    },
    toast: toast,
    onSaved: saved
  }))))));
}

/* ---------------- Scanner ---------------- */

function ScannerTab({
  toast,
  confirm
}) {
  const [rows, setRows] = useState(null);
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(null);
  const go = async (name, fn) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(null);
  };
  const check = () => go("check", async () => {
    setLog(null);
    setRows(await api("check"));
  });
  const real = (route, title, body) => go(route, async () => {
    if (!(await confirm(title, body))) return;
    setRows(null);
    setLog((await api(route)).log);
    toast("Done", "ok");
  });
  return /*#__PURE__*/React.createElement(Fade, {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card stack"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Rule-based strategies"), /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, "Checked every 5 minutes by ", /*#__PURE__*/React.createElement("code", null, "scan.py"), " on your VPS.")), /*#__PURE__*/React.createElement("div", {
    className: "row wrap gap"
  }, /*#__PURE__*/React.createElement(Btn, {
    disabled: !!busy,
    onClick: check
  }, busy === "check" ? "Fetching candles…" : "Check now (preview)"), /*#__PURE__*/React.createElement(Btn, {
    className: "ghost",
    disabled: !!busy,
    onClick: () => real("scan", "Run the real scanner?", "New signals are sent to Telegram and those candles are marked as checked.")
  }, busy === "scan" ? "Running…" : "Run scanner once → Telegram"))), /*#__PURE__*/React.createElement("div", {
    className: "card stack"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "AI strategies"), /*#__PURE__*/React.createElement("span", {
    className: "dim small"
  }, "Run once a day by ", /*#__PURE__*/React.createElement("code", null, "daily.py"), " at 17:07 New York, right after the daily close.")), /*#__PURE__*/React.createElement("div", {
    className: "row wrap gap"
  }, /*#__PURE__*/React.createElement(Btn, {
    className: "ghost",
    disabled: !!busy,
    onClick: () => real("daily_run", "Run the daily AI job?", `Every AI strategy pair is analyzed (~$${COST_PER_PAIR} each) and pairs with a bias go to Telegram. Already-analyzed daily candles are skipped.`)
  }, busy === "daily_run" ? "Running… (a few minutes)" : "Run daily AI once → Telegram"))), /*#__PURE__*/React.createElement(AnimatePresence, {
    mode: "wait"
  }, rows && /*#__PURE__*/React.createElement(Fade, {
    key: "rows",
    className: "card scroll"
  }, !rows.length ? /*#__PURE__*/React.createElement("p", {
    className: "dim"
  }, "No rule-based strategies saved. AI strategies are on the Daily analysis tab.") : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Strategy"), /*#__PURE__*/React.createElement("th", null, "Pair"), /*#__PURE__*/React.createElement("th", null, "TF"), /*#__PURE__*/React.createElement("th", null, "Last closed candle"), /*#__PURE__*/React.createElement("th", null, "Close"), /*#__PURE__*/React.createElement("th", null, "Signal"))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement(motion.tr, {
    key: i,
    initial: {
      opacity: 0,
      y: 6
    },
    animate: {
      opacity: 1,
      y: 0
    },
    transition: {
      delay: i * 0.03
    }
  }, /*#__PURE__*/React.createElement("td", null, r.strategy), /*#__PURE__*/React.createElement("td", null, pretty(r.pair)), /*#__PURE__*/React.createElement("td", null, r.timeframe), r.error ? /*#__PURE__*/React.createElement("td", {
    colSpan: 3,
    className: "err"
  }, r.error) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("td", null, r.candle), /*#__PURE__*/React.createElement("td", null, r.close), /*#__PURE__*/React.createElement("td", null, r.signals.length ? r.signals.map((x, j) => /*#__PURE__*/React.createElement("div", {
    key: j
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: x.side === "LONG" ? "var(--long)" : "var(--short)"
    }
  }, x.side), " ", x.entry, " \xB7 SL ", x.sl, " \xB7 TP ", x.tp)) : /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "\u2014")))))))), log && /*#__PURE__*/React.createElement(Fade, {
    key: "log",
    className: "card"
  }, /*#__PURE__*/React.createElement("pre", {
    className: "log"
  }, log))));
}

/* ---------------- App ---------------- */

function App() {
  const [tab, setTab] = useState(() => store.get("fx.tab", "analysis"));
  const [keys, setKeys] = useState({});
  const [strategies, setStrategies] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmEl, confirm] = useConfirm();
  useEffect(() => store.set("fx.tab", tab), [tab]);
  const toast = useCallback((text, kind = "info") => {
    const id = Math.random();
    setToasts(t => [...t.slice(-3), {
      id,
      text,
      kind
    }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === "error" ? 8000 : 3500);
  }, []);
  const reload = useCallback(() => api("strategies").then(setStrategies).catch(e => toast(e.message, "error")), [toast]);
  useEffect(() => {
    api("status").then(setKeys).catch(e => toast(e.message, "error"));
    reload();
  }, []);
  const list = strategies || [];
  const tabs = [["analysis", "Daily analysis", list.filter(s => s.type === "ai").length || null], ["strategies", "Strategies", list.length || null], ["add", "Add strategy"], ["scanner", "Scanner & Telegram"]];
  const props = {
    strategies: list,
    reload,
    toast,
    confirm,
    goAdd: () => setTab("add"),
    goStrategies: () => setTab("strategies")
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", null, /*#__PURE__*/React.createElement("div", {
    className: "row gap"
  }, /*#__PURE__*/React.createElement(motion.div, {
    className: "logo",
    initial: {
      rotate: -90,
      scale: 0
    },
    animate: {
      rotate: 0,
      scale: 1
    },
    transition: spring
  }, "\u2197"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Forex Signals"), /*#__PURE__*/React.createElement("div", {
    className: "dim small"
  }, "YouTube strategies \u2192 candles \u2192 Telegram"))), /*#__PURE__*/React.createElement(KeyPills, {
    keys: keys
  })), /*#__PURE__*/React.createElement(Segmented, {
    id: "tabs",
    value: tab,
    onChange: setTab,
    options: tabs
  }), strategies === null ? /*#__PURE__*/React.createElement("div", {
    className: "dim"
  }, "Loading\u2026") : /*#__PURE__*/React.createElement(AnimatePresence, {
    mode: "wait"
  }, /*#__PURE__*/React.createElement(motion.div, {
    key: tab
  }, tab === "analysis" && /*#__PURE__*/React.createElement(AnalysisTab, props), tab === "strategies" && /*#__PURE__*/React.createElement(StrategiesTab, props), tab === "add" && /*#__PURE__*/React.createElement(AddTab, props), tab === "scanner" && /*#__PURE__*/React.createElement(ScannerTab, props))), confirmEl, /*#__PURE__*/React.createElement(Toasts, {
    items: toasts
  }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));