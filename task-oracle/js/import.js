/* Task Oracle — spreadsheet import (Notion Tasks / Reoccurring tasks exports, Excel, CSV) */
window.TO = window.TO || {};
(function (TO) {
  const IM = (TO.importer = {});

  const norm = (h) => String(h ?? "").replace(/^﻿/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ALIASES = {
    name: ["name", "task", "taskname", "title", "tasks"],
    time: ["timeblock", "time", "duration", "timerequired", "estimate", "minutes"],
    category: ["category", "categories"],
    tags: ["tags", "tag"],
    routine: ["routine", "routines"],
    priority: ["priority"],
    progress: ["progress"],
    status: ["status"],
    items: ["items", "requireditems", "item"],
    notes: ["notes", "note", "description"],
    link: ["link", "url"],
    day: ["day", "days"],
    optional: ["optional"],
    hide: ["hide", "hidden"],
    when: ["when"],
  };
  const MAP = {};
  Object.entries(ALIASES).forEach(([k, list]) => list.forEach((a) => (MAP[a] = k)));

  /** RFC4180 CSV (quoted fields, commas and newlines inside quotes). */
  IM.parseCSV = (text) => {
    text = String(text).replace(/^﻿/, "");
    const rows = [];
    let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); rows.push(row); row = []; f = "";
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  };

  /** Notion relation export: "Laptop (https://www.notion.so/...), Charger (https://...)" → ["Laptop","Charger"] */
  IM.splitRelation = (v) => {
    const s = String(v || "").trim();
    if (!s) return [];
    if (/\(https?:\/\//.test(s)) {
      const out = [];
      const re = /\s*([^,(][^(]*?)\s*\((https?:\/\/[^)]*)\)\s*,?/g;
      let m;
      while ((m = re.exec(s))) if (m[1].trim()) out.push(m[1].trim());
      return out;
    }
    return IM.splitList(s);
  };
  IM.splitList = (v) => String(v || "").split(/\s*[,|;]\s*/).map((x) => x.trim()).filter(Boolean);

  /** "10 m" → 10, "1h 30m" → 90, "45" → 45, "All Day" → 480 */
  IM.minutes = (v) => {
    const s = String(v || "").trim().toLowerCase();
    if (!s) return null;
    if (/all\s*day/.test(s)) return 480;
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
    let total = 0, found = false, m;
    const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|m)(?![a-z])/g;
    while ((m = re.exec(s))) { found = true; total += parseFloat(m[1]) * (m[2][0] === "h" ? 60 : 1); }
    if (found) return Math.round(total);
    const hm = s.match(/^(\d+):(\d{2})/);
    return hm ? +hm[1] * 60 + +hm[2] : null;
  };

  const yes = (v) => /^(yes|true|1|x|✓|__yes__|optional)$/i.test(String(v || "").trim());

  /**
   * Converts a 2D table into tasks.
   * Returns { tasks, kind, skipped:{done,hidden,inactive,empty}, columns, ignored }
   */
  IM.fromTable = (table, source, opts = {}) => {
    const res = { tasks: [], kind: "generic", skipped: { done: 0, hidden: 0, inactive: 0, empty: 0 }, columns: [], ignored: [] };
    if (!table.length) return res;
    const header = table[0].map((h) => MAP[norm(h)] || null);
    const hasHeader = header.includes("name");
    if (!hasHeader) {
      // legacy format: Task Name, Time, Item1 | Item2, Notes (header row optional)
      res.kind = "legacy";
      const first = norm(table[0][0]);
      const rows = ["task", "name", "taskname", "title"].includes(first) ? table.slice(1) : table;
      rows.forEach((r) => {
        const name = String(r[0] || "").trim();
        if (!name) { res.skipped.empty++; return; }
        res.tasks.push(make({ name, time: r[1], items: IM.splitList(String(r[2] || "").replace(/\|/g, ",")), notes: r[3], source }));
      });
      return res;
    }
    res.columns = header.filter(Boolean);
    table[0].forEach((h, i) => { if (!header[i] && String(h).trim()) res.ignored.push(String(h).trim()); });
    if (header.includes("routine") || header.includes("day") || header.includes("status")) res.kind = "recurring";
    else if (header.includes("progress") || header.includes("category") || header.includes("priority")) res.kind = "tasks";
    table.slice(1).forEach((cells) => {
      const r = {};
      header.forEach((k, i) => { if (k && r[k] === undefined) r[k] = cells[i] ?? ""; });
      const name = String(r.name || "").replace(/<[^>]+>/g, "").trim();
      if (!name) { res.skipped.empty++; return; }
      const progress = String(r.progress || "").trim();
      if (opts.skipDone !== false && /^(done|cancelled|canceled|complete|completed)$/i.test(progress)) { res.skipped.done++; return; }
      if (opts.skipHidden !== false && yes(r.hide)) { res.skipped.hidden++; return; }
      const status = String(r.status || "").trim();
      if (opts.onlyActive && status && !/^active$/i.test(status)) { res.skipped.inactive++; return; }
      res.tasks.push(make({
        name, time: r.time, source,
        category: IM.splitList(r.category), tags: IM.splitList(r.tags), routine: IM.splitList(r.routine),
        priority: String(r.priority || "").trim(), progress, status,
        items: IM.splitRelation(r.items), notes: r.notes, link: String(r.link || "").trim(),
        day: IM.splitList(r.day), optional: yes(r.optional),
      }));
    });
    return res;
  };

  function make(t) {
    const time = String(t.time || "").trim();
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: String(t.name).trim(),
      time,
      minutes: IM.minutes(time),
      category: t.category || [],
      tags: t.tags || [],
      routine: t.routine || [],
      priority: t.priority || "",
      progress: t.progress || "",
      status: t.status || "",
      items: t.items || [],
      notes: String(t.notes || "").trim(),
      link: /^https?:\/\//i.test(t.link || "") ? t.link : "",
      day: t.day || [],
      optional: !!t.optional,
      source: t.source || "",
    };
  }
  IM.make = make;

  /** Reads a File into a 2D table (xlsx/xls/ods via SheetJS, csv/tsv/txt natively). */
  IM.readFile = async (file) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (["csv", "tsv", "txt"].includes(ext)) {
      const text = await file.text();
      const firstLine = text.split(/\r?\n/)[0] || "";
      if (firstLine.includes("\t") && !firstLine.includes(",")) return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split("\t"));
      return IM.parseCSV(text);
    }
    if (!window.XLSX) throw new Error("The Excel reader couldn't load. Check your connection, or save the sheet as CSV.");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    // first sheet that has a recognisable header, else the first sheet
    let best = null;
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: "" }).filter((r) => r.some((c) => String(c).trim()));
      if (!rows.length) continue;
      if (!best) best = rows;
      if (rows[0].some((h) => MAP[norm(h)] === "name")) return rows;
    }
    return best || [];
  };

  IM.sourceName = (filename) =>
    String(filename || "Import").replace(/\.[^.]+$/, "").replace(/\s+[0-9a-f]{32}(_all)?$/i, "").replace(/^[^\w]+/, "").trim() || "Import";

  /* ---------- export ---------- */
  IM.COLS = ["Name", "Time block", "Category", "Tags", "Routine", "Priority", "Items", "Notes", "Link", "Day"];
  IM.toRows = (tasks) => [
    IM.COLS,
    ...tasks.map((t) => [t.name, t.time, t.category.join(", "), t.tags.join(", "), t.routine.join(", "), t.priority, t.items.join(", "), t.notes, t.link, t.day.join(", ")]),
  ];
  IM.write = (filename, rows) => {
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = rows[0].map((_, i) => ({ wch: Math.min(48, Math.max(10, ...rows.map((r) => String(r[i] ?? "").length + 2))) }));
      XLSX.utils.book_append_sheet(wb, ws, "Tasks");
      XLSX.writeFile(wb, filename + ".xlsx");
      return "xlsx";
    }
    const csv = rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = filename + ".csv";
    a.click();
    return "csv";
  };
})(window.TO);
