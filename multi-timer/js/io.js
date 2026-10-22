/* Multi Timer — import/export: Excel/CSV/Notion CSV, linked-sheet URL sync, .mt backups, Web Share links */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util, S = MT.store, UI = MT.ui;
  const IO = (MT.io = {});
  const A = () => MT.app;

  /* ======================= Parsing ======================= */
  const norm = (h) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ALIASES = {
    board: ["board", "boardname", "category", "group", "list", "section", "tab", "project"],
    name: ["name", "timer", "timername", "title", "task", "label", "activity"],
    type: ["type", "timertype", "kind"],
    duration: ["duration", "time", "timeblock", "length", "minutes", "mins", "period", "work", "worktime"],
    color: ["color", "colour"],
    icon: ["icon"],
    autoRepeat: ["autorepeat", "repeat", "loop"],
    autoComplete: ["autocomplete", "autocompletion", "autoreset"],
    extraInfo: ["extrainfo", "extra"],
    addTimeButtons: ["addtimebuttons", "addtime", "quickadd"],
    note: ["note", "notes", "description", "comment", "comments"],
    intervals: ["intervals", "steps", "segments"],
    repeats: ["repeats", "repetitions", "rounds", "cycles", "sets"],
    shortBreak: ["shortbreak", "break"],
    longBreak: ["longbreak"],
    sessions: ["sessions", "sessionsbeforelongbreak"],
    initial: ["initial", "initialvalue", "startvalue", "from"],
    final: ["final", "finalvalue", "target", "goal", "to"],
    step: ["step", "increment"],
    tz: ["timezone", "tz", "zone"],
    startFrom: ["countfrom", "startfrom", "since"],
    sound: ["sound", "alertsound", "alarm"],
  };
  const HEADER_MAP = {};
  Object.entries(ALIASES).forEach(([field, list]) => list.forEach((a) => (HEADER_MAP[a] = field)));

  const TYPE_MAP = {
    countdown: "countdown", timer: "countdown", countdowntimer: "countdown", "": "countdown",
    quick: "quick", quicktimer: "quick",
    interval: "interval", intervals: "interval", intervaltimer: "interval", hiit: "interval", tabata: "interval",
    pomodoro: "pomodoro", pomodorotimer: "pomodoro", tomato: "pomodoro",
    countup: "countup", countuptimer: "countup", elapsed: "countup",
    stopwatch: "stopwatch",
    counter: "counter", count: "counter", tally: "counter",
    clock: "clock", worldclock: "clock",
  };
  const bool = (v) => /^(y|yes|true|1|x|on|✓|✔)$/i.test(String(v ?? "").trim());
  const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  /** Duration that also understands Excel time cells ({__day: fraction}). */
  const dur = (v) => (v && typeof v === "object" && "__day" in v ? Math.round(v.__day * U.DAY) : U.parseDuration(v));

  IO.parseIntervals = (text) => {
    const out = [];
    String(text || "").split(/[;|\n]+/).forEach((part, i) => {
      const p = part.trim();
      if (!p) return;
      const m = p.match(/^(.*?)[\s:=\-–]*((?:\d+(?:\.\d+)?\s*(?:days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)(?![a-z])\s*)+|\d+:\d{2}(?::\d{2})?|\d+(?:\.\d+)?)$/i);
      if (!m) return;
      const ms = U.parseDuration(m[2]);
      if (!ms) return;
      out.push({ name: m[1].trim() || `Interval ${i + 1}`, duration: ms, color: U.paletteColor(i + 3) });
    });
    return out;
  };

  /** Converts a 2D table (first non-empty row = header) into timer specs grouped by board. */
  IO.parseTable = (table, fallbackBoard, result) => {
    const headerIdx = table.findIndex((r) => r.some((c) => has(c)));
    if (headerIdx < 0) return;
    const header = table[headerIdx].map((h) => HEADER_MAP[norm(h)] || null);
    table[headerIdx].forEach((h, i) => { if (has(h) && !header[i]) result.ignored.add(String(h).trim()); });
    if (!header.includes("name") && !header.includes("duration")) {
      result.errors.push(`“${fallbackBoard}”: no Name or Duration column found (headers: ${table[headerIdx].filter(has).join(", ")})`);
      return;
    }
    table.slice(headerIdx + 1).forEach((cells, k) => {
      const rowNo = headerIdx + k + 2;
      const r = {};
      header.forEach((f, i) => { if (f && r[f] === undefined) r[f] = cells[i]; });
      if (!Object.values(r).some(has)) return;
      const spec = IO.rowToSpec(r, rowNo, fallbackBoard, result);
      if (!spec) return;
      const boardName = has(r.board) ? String(r.board).trim() : fallbackBoard;
      if (!result.boards.has(boardName)) result.boards.set(boardName, []);
      result.boards.get(boardName).push(spec);
    });
  };

  IO.rowToSpec = (r, rowNo, sheet, result) => {
    const where = `${sheet} row ${rowNo}`;
    const typeKey = norm(r.type);
    let type = TYPE_MAP[typeKey];
    if (!type) { result.warnings.push(`${where}: unknown type “${r.type}”, using countdown`); type = "countdown"; }
    const o = { type };
    const name = has(r.name) ? String(r.name).trim() : "";
    if (name) o.name = name;
    if (has(r.color)) {
      const c = U.parseColor(r.color);
      if (c) o.color = c; else result.warnings.push(`${where}: unknown color “${r.color}”`);
    }
    if (has(r.icon)) {
      const ic = String(r.icon).trim().replace(/^fa-(solid\s+fa-)?/, "");
      if (MT.icons.valid(ic)) o.icon = ic; else result.warnings.push(`${where}: unknown icon “${r.icon}”`);
    } else if (name) o.icon = MT.icons.guess(name);
    if (has(r.autoRepeat)) o.autoRepeat = bool(r.autoRepeat);
    if (has(r.autoComplete)) o.autoComplete = bool(r.autoComplete);
    if (has(r.extraInfo)) {
      const x = norm(r.extraInfo);
      const map = { overtime: "overtime", elapsed: "elapsed", elapsedtime: "elapsed", start: "start", starttime: "start", finish: "finish", finishtime: "finish", end: "finish", none: "none" };
      if (map[x]) o.extraInfo = map[x];
    }
    if (has(r.addTimeButtons)) {
      const list = String(r.addTimeButtons).split(/[,;|]/).map((s) => {
        const t = s.trim();
        const neg = t.startsWith("-");
        const v = U.parseDuration(t.replace(/^[+-]/, ""));
        return v ? (neg ? -v : v) : null;
      }).filter(Boolean);
      if (list.length) o.addTimeButtons = list.slice(0, 6);
    }
    if (has(r.note)) o.note = String(r.note);
    if (has(r.sound)) {
      const s = MT.sounds.list().find((x) => norm(x.name) === norm(r.sound) || x.id === String(r.sound).trim());
      if (s) o.alert = { sound: s.id, vibrate: false, repeat: 1 };
    }
    const d = has(r.duration) ? dur(r.duration) : null;
    if (has(r.duration) && d == null) { result.errors.push(`${where}: can't read time “${r.duration}” for “${name || "?"}”`); return null; }

    switch (type) {
      case "countdown":
        if (!d) { result.errors.push(`${where}: “${name || "?"}” has no time`); return null; }
        o.duration = d;
        break;
      case "quick":
        if (d) o.duration = d;
        break;
      case "interval": {
        let iv = IO.parseIntervals(r.intervals);
        if (!iv.length && d) iv = [{ name: name || "Interval", duration: d, color: o.color || U.paletteColor(3) }];
        if (!iv.length) { result.errors.push(`${where}: interval timer “${name || "?"}” needs an Intervals value like “Work 40s; Rest 20s”`); return null; }
        o.intervals = iv;
        if (has(r.repeats)) o.repeats = Math.max(1, parseInt(r.repeats, 10) || 1);
        break;
      }
      case "pomodoro":
        if (d) o.work = d;
        if (has(r.shortBreak)) o.shortBreak = dur(r.shortBreak) || 0;
        if (has(r.longBreak)) o.longBreak = dur(r.longBreak) || 0;
        if (has(r.sessions)) o.sessions = Math.max(1, parseInt(r.sessions, 10) || 4);
        break;
      case "countup":
        if (has(r.startFrom)) {
          const v = r.startFrom;
          if (v && v.__day != null) {
            // Excel serial date: its UTC fields are the sheet's wall-clock time
            const t = new Date(Math.round((v.__day - 25569) * U.DAY));
            if (!isNaN(t)) o.startFrom = t.toISOString().slice(0, 16);
          } else {
            const t = v instanceof Date ? v : new Date(String(v));
            if (!isNaN(t)) o.startFrom = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          }
        }
        if (d) o.milestones = [d];
        break;
      case "counter":
        if (has(r.initial)) o.initial = Number(r.initial) || 0;
        if (has(r.final)) o.final = Number(r.final);
        if (has(r.step)) o.step = Math.abs(Number(r.step)) || 1;
        break;
      case "clock":
        if (has(r.tz)) {
          const tz = String(r.tz).trim();
          try { new Intl.DateTimeFormat("en", { timeZone: tz }); o.tz = tz; } catch (e) { result.warnings.push(`${where}: unknown time zone “${tz}”`); }
        }
        break;
    }
    if (!o.name) o.name = type === "quick" ? "" : S.TYPE_INFO[type].label;
    return o;
  };

  const newResult = () => ({ boards: new Map(), errors: [], warnings: [], ignored: new Set() });
  const baseName = (fn) => String(fn || "Imported").replace(/\.[^.]+$/, "").replace(/^MultiTimer - /, "").trim() || "Imported";

  /** Reads an xlsx/xls/ods ArrayBuffer with SheetJS, keeping Excel time cells as day fractions. */
  IO.parseWorkbook = (buf, filename, result = newResult()) => {
    if (!window.XLSX) throw new Error("The Excel reader (SheetJS) could not load. Check your connection, or save the sheet as CSV.");
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    wb.SheetNames.forEach((sn) => {
      const ws = wb.Sheets[sn];
      if (!ws || !ws["!ref"]) return;
      if (/^(help|readme|instructions)$/i.test(sn)) return;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const table = [];
      for (let R = range.s.r; R <= range.e.r; R++) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; C++) {
          const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (!c) { row.push(""); continue; }
          if (c.t === "n" && c.z && isTimeFormat(c.z)) row.push({ __day: c.v });
          else if (c.t === "n" && c.z && isDateFormat(c.z)) row.push({ __day: c.v, date: true });
          else row.push(c.v);
        }
        table.push(row);
      }
      const fallback = /^sheet\s*\d*$/i.test(sn) ? baseName(filename) : sn;
      IO.parseTable(table, fallback, result);
    });
    return result;
  };
  const stripFmt = (z) => String(z).replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "");
  const isTimeFormat = (z) => { const s = stripFmt(z).toLowerCase(); return /[hs]/.test(s) && /:/.test(s) && !/[dy]/.test(s); };
  const isDateFormat = (z) => /[dy]/.test(stripFmt(z).toLowerCase()) && z !== "General";

  IO.parseCSVText = (text, filename, result = newResult()) => {
    const tab = /\t/.test(text.split(/\r?\n/)[0] || "") && !/,/.test(text.split(/\r?\n/)[0] || "");
    const table = tab ? text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split("\t")) : U.parseCSV(text);
    IO.parseTable(table, baseName(filename), result);
    return result;
  };

  /* ======================= Applying ======================= */
  const CONFIG_SKIP = new Set(["id", "type", "rt"]);

  /** mode: 'merge' (add new + update matches) | 'mirror' (boards in the sheet match it exactly). */
  IO.apply = (result, mode = "merge") => {
    S.checkpoint();
    const summary = { added: 0, updated: 0, removed: 0, boards: 0 };
    // drop the untouched default board when the import brings its own boards
    const only = S.state.boards.length === 1 && S.state.boards[0];
    if (only && !only.elements.length && only.name === "Timers" && ![...result.boards.keys()].some((n) => n.toLowerCase() === "timers"))
      S.state.boards = [];
    result.boards.forEach((specs, boardName) => {
      let b = S.state.boards.find((x) => x.name.toLowerCase() === boardName.toLowerCase());
      if (!b) { b = S.createBoard(boardName); S.state.boards.push(b); summary.boards++; }
      const keep = new Set();
      specs.forEach((spec, i) => {
        const match = b.elements.find((e) => e.type === spec.type && (e.name || "").toLowerCase() === (spec.name || "").toLowerCase() && !keep.has(e.id));
        if (match) {
          Object.keys(spec).forEach((k) => { if (!CONFIG_SKIP.has(k)) match[k] = U.clone(spec[k]); });
          if (match.type === "counter" && match.rt.status === "inactive") match.rt.count = match.initial;
          keep.add(match.id);
          summary.updated++;
        } else {
          const el = S.createElement(spec.type, { color: U.paletteColor(b.elements.length + i), ...spec });
          if (el.type === "counter") el.rt.count = el.initial;
          b.elements.push(el);
          keep.add(el.id);
          summary.added++;
        }
      });
      if (mode === "mirror") {
        b.elements.filter((e) => !keep.has(e.id) && MT.engine.hasRuntime(e)).forEach((e) => {
          MT.engine.stopRinging(e.id);
          b.elements.splice(b.elements.indexOf(e), 1);
          S.state.trash.unshift({ kind: "element", data: e, boardId: b.id, boardName: b.name, deletedAt: Date.now() });
          summary.removed++;
        });
      }
    });
    if (!S.state.boards.length) S.state.boards.push(S.createBoard("Timers"));
    if (!S.board(S.state.activeBoardId)) S.state.activeBoardId = S.state.boards[0].id;
    S.save();
    return summary;
  };

  const summaryText = (s) =>
    [s.added && `${s.added} added`, s.updated && `${s.updated} updated`, s.removed && `${s.removed} removed`, s.boards && `${s.boards} new board${s.boards > 1 ? "s" : ""}`]
      .filter(Boolean).join(", ") || "No changes";

  IO.previewDialog = (result, { title = "Import timers", source } = {}) =>
    new Promise((resolve) => {
      const total = [...result.boards.values()].reduce((a, l) => a + l.length, 0);
      const boardsHtml = [...result.boards.entries()].map(([name, list]) => {
        const exists = S.state.boards.some((b) => b.name.toLowerCase() === name.toLowerCase());
        return `<div class="mt-list-row"><span class="flex-1 min-w-0"><span class="block font-medium truncate">${U.esc(name)}</span>
          <span class="mt-sub block truncate">${list.slice(0, 6).map((s) => U.esc(s.name || S.TYPE_INFO[s.type].label)).join(", ")}${list.length > 6 ? "…" : ""}</span></span>
          <span class="mt-sub text-right ml-2">${list.length} timer${list.length === 1 ? "" : "s"}<br>${exists ? "existing board" : "new board"}</span></div>`;
      }).join("");
      const issues = [...result.errors.map((e) => `<li class="text-red-500">${U.esc(e)}</li>`), ...result.warnings.map((w) => `<li class="text-amber-600">${U.esc(w)}</li>`)];
      const body = `
        ${total ? `<div class="mt-card mb-3">${boardsHtml}</div>` : `<p class="text-sm text-red-500 mb-3">No timers could be read from this file.</p>`}
        ${result.ignored.size ? `<p class="mt-sub mb-2">Ignored columns: ${[...result.ignored].map(U.esc).join(", ")}</p>` : ""}
        ${issues.length ? `<details class="mb-3" ${result.errors.length ? "open" : ""}><summary class="text-sm font-semibold cursor-pointer">${result.errors.length} row(s) skipped, ${result.warnings.length} warning(s)</summary><ul class="text-xs mt-2 space-y-1 max-h-40 overflow-auto">${issues.join("")}</ul></details>` : ""}
        ${total ? `<div class="mt-section-title">When a board already exists</div>
          <label class="mt-choice"><input type="radio" name="imp-mode" value="merge" ${source?.mode !== "mirror" ? "checked" : ""}/><span class="text-left"><span class="block">Merge</span><span class="mt-sub">Add new timers, update timers with the same name and type</span></span></label>
          <label class="mt-choice"><input type="radio" name="imp-mode" value="mirror" ${source?.mode === "mirror" ? "checked" : ""}/><span class="text-left"><span class="block">Mirror the sheet</span><span class="mt-sub">Also remove timers that are not in the sheet (they go to Deleted data)</span></span></label>` : ""}`;
      let out = null;
      UI.dialog({
        title, wide: true, body,
        buttons: total
          ? [{ label: "Cancel", kind: "ghost" }, { label: `Import ${total} timer${total === 1 ? "" : "s"}`, kind: "primary", onClick: (c, el) => { out = el.querySelector('input[name="imp-mode"]:checked').value; } }]
          : [{ label: "Close", kind: "ghost" }],
        onClose: () => resolve(out),
      });
    });

  /* ======================= File import ======================= */
  IO.pickFile = () => {
    const inp = document.getElementById("file-import");
    inp.value = "";
    inp.onchange = () => inp.files[0] && IO.importFile(inp.files[0]);
    inp.click();
  };

  IO.importFile = async (file) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    try {
      if (ext === "mt" || ext === "json") return IO.importMT(await U.readFile(file, "text"));
      let result;
      if (ext === "csv" || ext === "tsv" || ext === "txt") result = IO.parseCSVText(await U.readFile(file, "text"), file.name);
      else result = IO.parseWorkbook(await U.readFile(file), file.name);
      const mode = await IO.previewDialog(result, { title: `Import “${U.esc(file.name)}”` });
      if (!mode) return;
      const s = IO.apply(result, mode);
      const first = [...result.boards.keys()][0];
      const b = first && S.state.boards.find((x) => x.name.toLowerCase() === first.toLowerCase());
      if (b) S.state.activeBoardId = b.id;
      S.save();
      A().go("board");
      UI.toast(`Imported: ${summaryText(s)}`);
    } catch (err) {
      console.error(err);
      UI.alert(U.esc(err.message || String(err)), "Import failed");
    }
  };

  /* ======================= .mt backups ======================= */
  const cleanBoard = (b) => {
    const c = U.clone(b);
    c.elements.forEach((e) => (e.rt = e.type === "counter" ? { status: "inactive", count: e.initial } : { status: "inactive" }));
    return c;
  };
  /** Copies boards with fresh ids, re-pointing internal references. */
  const freshBoards = (boards) => {
    const idMap = {};
    const out = boards.map((b) => {
      const nb = U.clone(b);
      nb.id = U.uid();
      nb.name = S.uniqueBoardName(String(nb.name || "Imported"));
      nb.elements = (nb.elements || []).filter((e) => S.TYPE_INFO[e.type]).map((e) => {
        const ne = { ...S.defaults(e.type), ...e };
        idMap[e.id] = ne.id = U.uid();
        ne.rt = ne.type === "counter" ? { status: "inactive", count: ne.initial } : { status: "inactive" };
        return ne;
      });
      return nb;
    });
    out.forEach((b) => b.elements.forEach((e) => {
      if (e.type === "container" && idMap[e.ref]) e.ref = idMap[e.ref];
      if (e.type === "buttons") (e.buttons || []).forEach((bt) => (bt.commands || []).forEach((c) => { if (idMap[c.timer]) c.timer = idMap[c.timer]; }));
    }));
    return out;
  };

  IO.exportBoardsDialog = async (preselect) => {
    const ids = await UI.checklist("Exported boards", S.state.boards.map((b) => ({ value: b.id, label: b.name, checked: preselect ? b.id === preselect : true })), { okLabel: "Done" });
    if (!ids || !ids.length) return;
    const data = { app: "multi-timer", version: 1, exportedAt: new Date().toISOString(), boards: S.state.boards.filter((b) => ids.includes(b.id)).map(cleanBoard) };
    U.download("MultiTimer - boards.mt", JSON.stringify(data, null, 2), "application/json");
    UI.toast(`Exported ${ids.length} board${ids.length === 1 ? "" : "s"}`);
  };

  IO.importMT = async (text) => {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error("This file is not a Multi Timer backup."); }
    const boards = Array.isArray(data) ? data : data.boards;
    if (!Array.isArray(boards) || !boards.length) throw new Error("No boards found in this file.");
    const ids = await UI.checklist("Import boards", boards.map((b, i) => ({ value: i, label: `${b.name} (${(b.elements || []).length})`, checked: true })), { okLabel: "Import" });
    if (!ids || !ids.length) return;
    S.checkpoint();
    const added = freshBoards(ids.map((i) => boards[i]));
    S.state.boards.push(...added);
    S.state.activeBoardId = added[0].id;
    S.save();
    A().go("board");
    UI.toast(`Imported ${added.length} board${added.length === 1 ? "" : "s"}`);
  };

  /* ======================= Excel export & template ======================= */
  const COLS = ["Board", "Name", "Type", "Duration", "Color", "Icon", "Auto repeat", "Autocomplete", "Extra info", "Add time buttons", "Intervals", "Repeats", "Short break", "Long break", "Sessions", "Initial", "Final", "Step", "Timezone", "Count from", "Sound", "Note"];
  const h = (ms) => (ms ? U.fmtHuman(ms) : "");
  const rowFor = (b, e) => {
    const colorName = (U.PALETTE.find((p) => p.hex === e.color) || {}).name || e.color;
    const snd = e.alert && e.alert.sound ? MT.sounds.name(e.alert.sound) : "";
    const r = {
      Board: b.name, Name: e.name, Type: e.type, Color: colorName, Icon: e.icon || "",
      "Auto repeat": e.autoRepeat ? "yes" : "", Autocomplete: e.autoComplete ? "yes" : "",
      "Extra info": E_EXTRA[e.extraInfo] || "", Note: e.note || "", Sound: snd,
      "Add time buttons": (e.addTimeButtons || []).map((v) => (v < 0 ? "-" : "") + U.fmtHuman(Math.abs(v))).join(", "),
    };
    if (e.type === "countdown" || e.type === "quick") r.Duration = h(e.duration);
    if (e.type === "interval") { r.Intervals = e.intervals.map((i) => `${i.name} ${U.fmtHuman(i.duration)}`).join("; "); r.Repeats = e.repeats; }
    if (e.type === "pomodoro") { r.Duration = h(e.work); r["Short break"] = h(e.shortBreak); r["Long break"] = h(e.longBreak); r.Sessions = e.sessions; }
    if (e.type === "countup") { r["Count from"] = e.startFrom ? e.startFrom.replace("T", " ") : ""; r.Duration = h((e.milestones || [])[0]); }
    if (e.type === "counter") { r.Initial = e.initial; r.Final = e.final; r.Step = e.step; }
    if (e.type === "clock") r.Timezone = e.tz || "";
    return COLS.map((c) => r[c] ?? "");
  };
  const E_EXTRA = { overtime: "overtime", elapsed: "elapsed", start: "start time", finish: "finish time", none: "none" };

  IO.writeTable = (filename, sheetName, rows, extraSheets = []) => {
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      const add = (name, data) => {
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!cols"] = data[0].map((_, i) => ({ wch: Math.min(40, Math.max(8, ...data.map((r) => String(r[i] ?? "").length + 2))) }));
        XLSX.utils.book_append_sheet(wb, ws, name);
      };
      add(sheetName, rows);
      extraSheets.forEach(([n, d]) => add(n, d));
      XLSX.writeFile(wb, filename + ".xlsx");
    } else {
      U.download(filename + ".csv", "﻿" + U.toCSV(rows), "text/csv");
      UI.toast("Excel library unavailable — saved as CSV instead");
    }
  };

  IO.exportExcel = (boardIds) => {
    const rows = [COLS];
    let skipped = 0;
    S.state.boards.filter((b) => !boardIds || boardIds.includes(b.id)).forEach((b) =>
      b.elements.forEach((e) => {
        if (e.type === "buttons" || e.type === "container") { skipped++; return; }
        rows.push(rowFor(b, e));
      })
    );
    if (rows.length === 1) { UI.toast("No timers to export", "error"); return; }
    IO.writeTable("MultiTimer - timers", "Timers", rows);
    if (skipped) UI.toast(`${skipped} Buttons/Container element(s) are only kept in .mt backups`);
  };

  IO.downloadTemplate = () => {
    const ex = (o) => COLS.map((c) => o[c] ?? "");
    const rows = [COLS,
      ex({ Board: "Morning", Name: "Shower", Type: "countdown", Duration: "10m", Color: "blue", Icon: "shower", Autocomplete: "yes" }),
      ex({ Board: "Morning", Name: "Skin care", Type: "countdown", Duration: "25m", Color: "pink", Icon: "spa", "Extra info": "finish time" }),
      ex({ Board: "Morning", Name: "Brush teeth", Type: "countdown", Duration: "2m", Color: "cyan", Icon: "tooth" }),
      ex({ Board: "Kitchen", Name: "Egg timer", Type: "countdown", Duration: "9m 30s", Color: "yellow", Icon: "egg", "Add time buttons": "30s, 1m", Sound: "Bell" }),
      ex({ Board: "Kitchen", Name: "Quick", Type: "quick", Color: "orange" }),
      ex({ Board: "Work", Name: "Focus period", Type: "pomodoro", Duration: "25m", "Short break": "5m", "Long break": "15m", Sessions: 4, Color: "red", Icon: "brain" }),
      ex({ Board: "Work", Name: "Deep work", Type: "countdown", Duration: "2h", Color: "purple", Icon: "laptop-code", "Auto repeat": "", Note: "Phone in another room" }),
      ex({ Board: "Work", Name: "Meeting", Type: "countup", Duration: "45m", Color: "green", Icon: "users", Note: "Duration on a count-up timer = notify me after" }),
      ex({ Board: "Workout", Name: "HIIT", Type: "interval", Intervals: "Work 40s; Rest 20s", Repeats: 8, Color: "green", Icon: "dumbbell" }),
      ex({ Board: "Workout", Name: "Laps", Type: "stopwatch", Color: "pink", Icon: "person-running" }),
      ex({ Board: "Habits", Name: "Glasses of water", Type: "counter", Initial: 0, Final: 8, Step: 1, Color: "cyan", Icon: "glass-water" }),
      ex({ Board: "Habits", Name: "Cairo", Type: "clock", Timezone: "Africa/Cairo", Color: "orange" }),
    ];
    const help = [["Column", "What to put there"],
      ["Board", "Board (tab) the timer goes on. Aliases: Category, Group, List. Without it, the sheet name (or file name) is used."],
      ["Name", "Timer name. Aliases: Timer, Title, Task."],
      ["Type", "countdown (default), quick, interval, pomodoro, countup, stopwatch, counter, clock"],
      ["Duration", "25m · 1h 30m · 90 (minutes) · 01:30:00 · 25:00 (mm:ss) · 1d 2h. Aliases: Time, Time block, Minutes. Pomodoro: work time. Count-up: notify after."],
      ["Color", "red, orange, yellow, green, cyan, blue, purple, pink, or a hex code like #22c55e"],
      ["Icon", "Font Awesome icon name, e.g. shower, egg, brain, dumbbell. Leave empty to pick one from the name."],
      ["Auto repeat / Autocomplete", "yes / no"],
      ["Extra info", "overtime, elapsed, start time, finish time, none"],
      ["Add time buttons", "Comma-separated, e.g. 1m, 5m, -30s"],
      ["Intervals / Repeats", "Interval timers: “Work 40s; Rest 20s” and the number of rounds"],
      ["Short break / Long break / Sessions", "Pomodoro settings"],
      ["Initial / Final / Step", "Counter settings"],
      ["Timezone", "Clock time zone, e.g. Africa/Cairo, Europe/London"],
      ["Count from", "Count-up start date-time, e.g. 2026-01-01 09:00"],
      ["Sound", "Alarm, Beep, Chime, Bell, Digital, Soft, Silent"],
      ["Notion", "A Notion database exported as CSV works as-is: Category → board, Time block → duration."],
    ];
    IO.writeTable("MultiTimer - template", "Timers", rows, [["Help", help]]);
  };

  /* ======================= Linked sheets (URL sync) ======================= */
  IO.normalizeUrl = (url) => {
    const u = String(url).trim();
    const g = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (g && !/\/pub|output=|tqx=|format=csv/.test(u)) {
      const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
      return `https://docs.google.com/spreadsheets/d/${g[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
    }
    if (/dropbox\.com/.test(u)) return u.replace(/([?&])dl=0/, "$1dl=1");
    return u;
  };

  IO.fetchSource = async (src) => {
    const url = IO.normalizeUrl(src.url);
    let res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (e) {
      throw new Error("Couldn't reach this link. The host must allow cross-site access: in Google Sheets use Share → “Anyone with the link”, or File → Share → Publish to web → CSV. For OneDrive/Dropbox use a direct download link.");
    }
    if (!res.ok) throw new Error(`The link answered ${res.status}. Make sure the sheet is shared or published.`);
    const ct = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf.slice(0, 4));
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf;
    const result = newResult();
    const fallback = src.board || baseName(decodeURIComponent(url.split("?")[0].split("/").pop())) || "Linked sheet";
    if (isZip || isOle || /spreadsheetml|ms-excel/.test(ct)) IO.parseWorkbook(buf, fallback, result);
    else {
      const text = new TextDecoder("utf-8").decode(buf);
      if (/^\s*<(!doctype|html)/i.test(text)) throw new Error("The link returned a web page, not a sheet. Use a published CSV or a direct download link.");
      IO.parseTable(/\t/.test(text.split("\n")[0]) && !/,/.test(text.split("\n")[0]) ? text.split(/\r?\n/).map((l) => l.split("\t")) : U.parseCSV(text), fallback, result);
    }
    return result;
  };

  IO.syncSource = async (src, { interactive = true } = {}) => {
    try {
      const result = await IO.fetchSource(src);
      let mode = src.mode || "merge";
      if (interactive && (!src.lastSync || result.errors.length)) {
        mode = await IO.previewDialog(result, { title: `Sync “${U.esc(src.label || src.url)}”`, source: src });
        if (!mode) return false;
        src.mode = mode;
      }
      const s = IO.apply(result, mode);
      src.lastSync = Date.now();
      src.lastResult = summaryText(s);
      S.save();
      A().render();
      UI.toast(`${src.label || "Sheet"} synced: ${summaryText(s)}`);
      return true;
    } catch (err) {
      src.lastError = err.message;
      S.save();
      if (interactive) UI.alert(U.esc(err.message), "Sync failed");
      else UI.toast(`${src.label || "Linked sheet"}: sync failed`, "error");
      return false;
    }
  };

  IO.autoSync = () => S.state.sources.filter((s) => s.autoSync).forEach((s) => IO.syncSource(s, { interactive: false }));

  IO.sourcesDialog = () => {
    const list = () => S.state.sources.length
      ? S.state.sources.map((s, i) => `<div class="mt-list-row items-start">
          <span class="flex-1 min-w-0"><span class="block font-medium truncate">${U.esc(s.label || "Linked sheet")}</span>
          <span class="mt-sub block truncate">${U.esc(s.url)}</span>
          <span class="mt-sub block">${s.lastSync ? `Synced ${U.fmtDateTime(s.lastSync)} · ${U.esc(s.lastResult || "")}` : "Never synced"}${s.autoSync ? " · syncs on open" : ""} · ${s.mode === "mirror" ? "mirror" : "merge"}</span>
          ${s.lastError ? `<span class="text-xs text-red-500 block">${U.esc(s.lastError)}</span>` : ""}</span>
          <button class="mt-btn mt-btn-soft ml-2" data-src-sync="${i}"><i class="fa-solid fa-rotate"></i><span class="hidden sm:inline ml-1">Sync</span></button>
          <button class="mt-icon-btn-sm text-red-500 ml-1" data-src-del="${i}" aria-label="Remove link"><i class="fa-solid fa-trash"></i></button></div>`).join("")
      : `<p class="mt-sub text-center py-4">No linked sheets yet.</p>`;
    const o = UI.dialog({
      title: "Linked sheets",
      wide: true,
      body: `<div class="mt-card mb-4" id="src-list">${list()}</div>
        <div class="mt-section-title">Link a sheet</div>
        <input id="src-url" class="mt-input mb-2" placeholder="https://docs.google.com/spreadsheets/d/… or a CSV/XLSX link"/>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <input id="src-label" class="mt-input" placeholder="Name (optional)"/>
          <input id="src-board" class="mt-input" placeholder="Board if the sheet has no Board column"/>
        </div>
        <label class="flex items-center gap-2 text-sm mb-1"><input type="checkbox" id="src-auto" class="mt-check" checked/> Sync automatically when the widget opens</label>
        <p class="mt-sub mt-2">Google Sheets: Share → “Anyone with the link can view” (or File → Share → Publish to web). Paste the normal sheet link — the tab in the link is used. Excel Online/OneDrive: use a direct download link.</p>`,
      buttons: [
        { label: "Close", kind: "ghost" },
        { label: "Link & sync", kind: "primary", onClick: (close, el) => {
          const url = el.querySelector("#src-url").value.trim();
          if (!/^https?:\/\//i.test(url)) { UI.toast("Paste a full http(s) link", "error"); return false; }
          const src = { id: U.uid(), url, label: el.querySelector("#src-label").value.trim() || "Linked sheet", board: el.querySelector("#src-board").value.trim(), autoSync: el.querySelector("#src-auto").checked, mode: "merge" };
          S.state.sources.push(src);
          S.save();
          IO.syncSource(src);
        } },
      ],
    });
    o.el.addEventListener("click", async (e) => {
      const sy = e.target.closest("[data-src-sync]");
      if (sy) {
        sy.disabled = true;
        await IO.syncSource(S.state.sources[+sy.dataset.srcSync]);
        o.el.querySelector("#src-list").innerHTML = list();
      }
      const del = e.target.closest("[data-src-del]");
      if (del) {
        S.state.sources.splice(+del.dataset.srcDel, 1);
        S.save();
        o.el.querySelector("#src-list").innerHTML = list();
      }
    });
  };

  /* ======================= Web Share ======================= */
  const compress = async (str) => {
    const bytes = new TextEncoder().encode(str);
    if (!window.CompressionStream) return "j." + U.b64encode(bytes);
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return "z." + U.b64encode(new Uint8Array(await new Response(cs).arrayBuffer()));
  };
  const decompress = async (s) => {
    const [kind, data] = [s.slice(0, 1), s.slice(2)];
    const bytes = U.b64decode(data);
    if (kind === "j") return new TextDecoder().decode(bytes);
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(ds).text();
  };

  IO.webShare = async (boardId) => {
    const b = S.board(boardId);
    const payload = { app: "multi-timer", v: 1, boards: [cleanBoard(b)] };
    const link = location.href.split("#")[0] + "#import=" + (await compress(JSON.stringify(payload)));
    if (navigator.share) {
      try { await navigator.share({ title: `Multi Timer — ${b.name}`, url: link }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const o = UI.dialog({
      title: "Web Share",
      body: `<p class="mt-sub mb-2">Anyone opening this link gets a copy of “${U.esc(b.name)}” (${b.elements.length} elements) in their own Multi Timer.</p>
        <textarea id="ws-link" class="mt-input font-mono text-xs h-28" readonly>${U.esc(link)}</textarea>`,
      buttons: [{ label: "Close", kind: "ghost" }, { label: "Copy link", kind: "primary", onClick: (c, el) => {
        const ta = el.querySelector("#ws-link");
        ta.select();
        (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => UI.toast("Link copied")).catch(() => { document.execCommand("copy"); UI.toast("Link copied"); });
      } }],
    });
    o.el.querySelector("#ws-link").addEventListener("focus", (e) => e.target.select());
  };

  IO.checkHashImport = async () => {
    const m = location.hash.match(/#import=([^&]+)/);
    if (!m) return;
    history.replaceState(null, "", location.href.split("#")[0]);
    try {
      const data = JSON.parse(await decompress(m[1]));
      if (!data || !Array.isArray(data.boards)) throw new Error("bad payload");
      const names = data.boards.map((b) => `“${U.esc(b.name)}” (${(b.elements || []).length} elements)`).join(", ");
      if (!(await UI.confirm(`Add the shared board ${names} to your Multi Timer?`, { title: "Shared board", okLabel: "Add board" }))) return;
      S.checkpoint();
      const added = freshBoards(data.boards);
      S.state.boards.push(...added);
      S.state.activeBoardId = added[0].id;
      S.save();
      A().go("board");
      UI.toast("Shared board added");
    } catch (e) {
      UI.toast("This share link is damaged or incomplete", "error");
    }
  };
})(window.MT);
