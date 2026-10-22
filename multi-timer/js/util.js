/* Multi Timer — shared helpers */
window.MT = window.MT || {};
(function (MT) {
  const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const U = (MT.util = { SEC, MIN, HOUR, DAY });

  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.pad = (n, l = 2) => String(Math.floor(Math.abs(n))).padStart(l, "0");
  U.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------- Colors ---------- */
  U.PALETTE = [
    { name: "red", hex: "#ef4444" },
    { name: "orange", hex: "#f97316" },
    { name: "yellow", hex: "#eab308" },
    { name: "green", hex: "#22c55e" },
    { name: "cyan", hex: "#06b6d4" },
    { name: "blue", hex: "#3b82f6" },
    { name: "purple", hex: "#a855f7" },
    { name: "pink", hex: "#ec4899" },
  ];
  const COLOR_ALIASES = {
    magenta: "pink", fuchsia: "pink", rose: "pink", violet: "purple", indigo: "blue", navy: "blue",
    teal: "cyan", turquoise: "cyan", aqua: "cyan", lime: "green", emerald: "green", amber: "yellow",
    gold: "yellow", crimson: "red", scarlet: "red",
  };
  U.parseColor = (v) => {
    if (!v) return null;
    const s = String(v).trim().toLowerCase();
    if (/^#?[0-9a-f]{6}$/.test(s)) return "#" + s.replace("#", "");
    if (/^#?[0-9a-f]{3}$/.test(s)) {
      const h = s.replace("#", "");
      return "#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (s === "gray" || s === "grey") return "#9ca3af";
    const name = COLOR_ALIASES[s] || s;
    const p = U.PALETTE.find((c) => c.name === name);
    return p ? p.hex : null;
  };
  U.paletteColor = (i) => U.PALETTE[((i % U.PALETTE.length) + U.PALETTE.length) % U.PALETTE.length].hex;
  U.rgba = (hex, a) => {
    const h = (hex || "#a855f7").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  /* ---------- Durations ---------- */
  U.split = (ms) => {
    let t = Math.floor(Math.abs(ms) / 1000);
    const d = Math.floor(t / 86400);
    t %= 86400;
    return { d, h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
  };

  /** "1d 2h 3m 4s" (zero parts omitted) */
  U.fmtHuman = (ms, withSeconds = true) => {
    if (ms == null || isNaN(ms)) return "—";
    const neg = ms < 0;
    const p = U.split(Math.round(Math.abs(ms) / 1000) * 1000);
    const out = [];
    if (p.d) out.push(p.d + "d");
    if (p.h) out.push(p.h + "h");
    if (p.m) out.push(p.m + "m");
    if (withSeconds && p.s) out.push(p.s + "s");
    if (!out.length) out.push(withSeconds ? "0s" : "0m");
    return (neg ? "-" : "") + out.join(" ");
  };

  /** Ring display: MM:SS, or HHh:MMm SS, or Dd HHh:MMm. Countdowns round up. */
  U.ringTime = (ms, { ceil = true, units = "auto" } = {}) => {
    const abs = Math.abs(ms);
    const total = ceil ? Math.ceil(abs / 1000 - 1e-6) : Math.floor(abs / 1000);
    const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60), s = total % 60;
    const P = U.pad;
    if (units === "ms" && d === 0) return `${P(h * 60 + m)}:${P(s)}`;
    if (d > 0) return `${d}<span class="u">d</span> ${P(h)}<span class="u">h</span>:${P(m)}<span class="u">m</span>`;
    if (h > 0 || units === "hms")
      return `${P(h)}<span class="u">h</span>:${P(m)}<span class="u">m</span><span class="sec">${P(s)}</span>`;
    return `${P(m)}:${P(s)}`;
  };

  /** Stopwatch display with centiseconds */
  U.swTime = (ms) => {
    const cs = Math.floor((ms % 1000) / 10);
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    if (h > 0) return `${h}<span class="u">h</span>:${U.pad(m)}:${U.pad(s)}`;
    return `${U.pad(m)}:${U.pad(s)}<span class="sec">.${U.pad(cs)}</span>`;
  };
  U.swText = (ms) => {
    const cs = Math.floor((ms % 1000) / 10), t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ":" : "") + U.pad(m) + ":" + U.pad(s) + "." + U.pad(cs);
  };
  U.plainTime = (ms) => {
    const t = Math.ceil(Math.abs(ms) / 1000 - 1e-6);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (ms < 0 ? "-" : "") + (h ? h + ":" + U.pad(m) : m) + ":" + U.pad(s);
  };

  /**
   * Parses durations: 25m, 1h 30m, 1h30m, 120 m, 90 (minutes), 01:30:00 (h:m:s),
   * 25:00 (m:s), 1d 2h, Excel numbers (<1 = fraction of a day, >=1 = minutes), Date (time of day).
   */
  U.parseDuration = (v) => {
    if (v == null || v === "") return null;
    if (v instanceof Date) {
      if (isNaN(v)) return null;
      return (v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds()) * 1000;
    }
    if (typeof v === "number") {
      if (!isFinite(v) || v < 0) return null;
      if (v > 0 && v < 1) return Math.round(v * DAY);
      return Math.round(v * MIN);
    }
    const s = String(v).trim().toLowerCase().replace(",", ".");
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * MIN);
    const c = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (c) {
      if (c[3] !== undefined) return (+c[1] * 3600 + +c[2] * 60 + +c[3]) * 1000;
      return (+c[1] * 60 + +c[2]) * 1000;
    }
    const re = /(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)(?![a-z])/g;
    let total = 0, found = false, x;
    while ((x = re.exec(s))) {
      found = true;
      const n = parseFloat(x[1]), u = x[2][0];
      total += n * (u === "d" ? DAY : u === "h" ? HOUR : u === "m" ? MIN : SEC);
    }
    return found ? Math.round(total) : null;
  };

  /* ---------- Dates ---------- */
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUNE", "JULY", "AUG", "SEPT", "OCT", "NOV", "DEC"];
  U.fmtDay = (ts) => {
    const d = new Date(ts);
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  U.dayKey = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  };
  U.fmtClock = (ts, seconds = true) => {
    const d = new Date(ts);
    return U.pad(d.getHours()) + ":" + U.pad(d.getMinutes()) + (seconds ? ":" + U.pad(d.getSeconds()) : "");
  };
  U.fmtDateTime = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())} ${U.fmtClock(ts)}`;
  };

  /* ---------- Files ---------- */
  U.download = (filename, data, mime = "application/octet-stream") => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  U.readFile = (file, as = "arrayBuffer") =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      if (as === "text") r.readAsText(file);
      else r.readAsArrayBuffer(file);
    });

  /** Minimal RFC4180 CSV parser (used when SheetJS is unavailable and for URL sync). */
  U.parseCSV = (text) => {
    text = String(text).replace(/^﻿/, "");
    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  };
  U.toCSV = (rows) =>
    rows
      .map((r) => r.map((c) => {
        const s = String(c ?? "");
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(","))
      .join("\r\n");

  /* ---------- Base64 (UTF-8 safe, url-safe) ---------- */
  U.b64encode = (bytes) => {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  U.b64decode = (str) => {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  U.debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
})(window.MT);
