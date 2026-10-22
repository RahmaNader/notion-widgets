/* Task Oracle — wheel, filters, picking, history, persistence */
(function (TO) {
  const IM = TO.importer;
  const KEY = "taskOracle.v1";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const PRIORITY_W = { low: 1, medium: 2, high: 3, "extremely high": 4 };
  const COLORS = [
    ["#3b0764", "#7c3aed"], ["#1e1b4b", "#818cf8"], ["#4c1d95", "#a78bfa"], ["#2e1065", "#8b5cf6"],
    ["#1a0035", "#c084fc"], ["#312e81", "#6366f1"], ["#581c87", "#d8b4fe"], ["#2d0060", "#9333ea"],
  ];
  const FACETS = [
    { key: "category", label: "Category" },
    { key: "routine", label: "Routine" },
    { key: "tags", label: "Tags" },
    { key: "priority", label: "Priority" },
    { key: "source", label: "Source" },
  ];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================= state ================= */
  const fresh = () => ({
    tasks: [],
    picked: [],
    history: [],
    filters: { category: [], routine: [], tags: [], priority: [], source: [], maxMinutes: 0, today: false, search: "" },
    settings: { noRepeat: true, weighted: false, sound: true, sky: "twilight" },
    lastResult: null,
    rotation: 0,
  });
  let st;
  try { st = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { st = fresh(); }
  st.filters = Object.assign(fresh().filters, st.filters);
  st.settings = Object.assign(fresh().settings, st.settings);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { toast("Couldn't save — browser storage is blocked or full"); } };

  /* ================= pool ================= */
  const valuesOf = (t, key) => (key === "priority" || key === "source" ? (t[key] ? [t[key]] : []) : t[key] || []);
  const today = () => DAYS[new Date().getDay()];
  function matches(t) {
    const f = st.filters;
    for (const { key } of FACETS) {
      if (f[key].length && !valuesOf(t, key).some((v) => f[key].includes(v))) return false;
    }
    if (f.maxMinutes && (t.minutes == null || t.minutes > f.maxMinutes)) return false;
    if (f.today && t.day.length && !t.day.includes(today())) return false;
    return true;
  }
  const filtered = () => st.tasks.filter(matches);
  const pool = () => {
    const list = filtered();
    if (!st.settings.noRepeat) return list;
    const picked = new Set(st.picked);
    return list.filter((t) => !picked.has(t.id));
  };
  const weight = (t) => (st.settings.weighted ? PRIORITY_W[String(t.priority).toLowerCase()] || 1 : 1);

  /** Segments: [{task, start, end}] in radians, measured clockwise from the pointer at rotation 0. */
  function segments(list) {
    const total = list.reduce((a, t) => a + weight(t), 0) || 1;
    let a = 0;
    return list.map((t, i) => {
      const span = (weight(t) / total) * Math.PI * 2;
      const s = { task: t, start: a, end: a + span, color: COLORS[i % COLORS.length] };
      a += span;
      return s;
    });
  }

  /* ================= wheel drawing ================= */
  const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  function applySky() {
    if (st.settings.sky === "midnight") document.documentElement.dataset.sky = "midnight";
    else delete document.documentElement.dataset.sky;
    document.querySelectorAll(".sky-switch button").forEach((b) => b.classList.toggle("on", b.dataset.sky === st.settings.sky));
  }
  const canvas = $("wheel");
  const ctx = canvas.getContext("2d");
  let segs = [];
  let rot = st.rotation || 0;
  let highlight = null;
  let spinning = false;

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.max(200, Math.round(r.width * dpr));
    if (canvas.width !== px) { canvas.width = canvas.height = px; }
    draw();
  }

  function draw() {
    const W = canvas.width, cx = W / 2, cy = W / 2, R = W / 2 - W * 0.008;
    const k = W / 500; // design scale
    ctx.clearRect(0, 0, W, W);
    if (!segs.length) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, cssVar("--hub-in", "#2d0060")); g.addColorStop(1, cssVar("--ring", "#100020"));
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(167,139,250,0.25)"; ctx.lineWidth = 2 * k; ctx.stroke();
      ctx.fillStyle = "rgba(167,139,250,0.45)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const msg = emptyMessage();
      ctx.font = `600 ${15 * k}px 'Cinzel', serif`; ctx.fillText(msg[0], cx, cy - 60 * k);
      ctx.font = `${13 * k}px 'Cinzel', serif`; ctx.fillText(msg[1], cx, cy + 60 * k);
      drawHub(cx, cy, k);
      return;
    }
    segs.forEach((s) => {
      const sa = s.start - Math.PI / 2 + rot, ea = s.end - Math.PI / 2 + rot;
      const hl = highlight === s.task.id;
      const [c0, c1] = s.color;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, hl ? "#5b21b6" : c0);
      g.addColorStop(0.65, hl ? "#a78bfa" : c1);
      g.addColorStop(1, hl ? "#c4b5fd88" : c1 + "99");
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, sa, ea); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = hl ? "rgba(226,201,126,0.9)" : "rgba(167,139,250,0.22)";
      ctx.lineWidth = (hl ? 2.5 : 1.2) * k; ctx.stroke();

      const mid = (sa + ea) / 2, span = ea - sa;
      // rim dot
      ctx.beginPath(); ctx.arc(cx + R * 0.93 * Math.cos(mid), cy + R * 0.93 * Math.sin(mid), 2.2 * k, 0, Math.PI * 2);
      ctx.fillStyle = hl ? "rgba(226,201,126,0.95)" : "rgba(245,227,163,0.4)"; ctx.fill();
      // label (skipped on slivers)
      const fs = Math.min(15, Math.max(0, R * span * 0.42 / k)) ;
      if (fs < 6.5) return;
      ctx.save();
      ctx.translate(cx, cy);
      // keep text upright: labels on the left half are flipped 180° and drawn from the rim inwards
      const norm = ((mid % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const flip = norm > Math.PI / 2 && norm < (Math.PI * 3) / 2;
      ctx.rotate(flip ? mid + Math.PI : mid);
      ctx.textAlign = flip ? "left" : "right"; ctx.textBaseline = "middle";
      ctx.font = `600 ${fs * k}px 'Cinzel', serif`;
      ctx.fillStyle = hl ? "#fff9c4" : "rgba(245,240,255,0.92)";
      ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4 * k;
      const maxW = R * 0.62;
      let label = s.task.name;
      if (ctx.measureText(label).width > maxW) {
        while (label.length > 2 && ctx.measureText(label + "…").width > maxW) label = label.slice(0, -1);
        label += "…";
      }
      ctx.fillText(label, flip ? -R * 0.86 : R * 0.86, 0);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(167,139,250,0.38)"; ctx.lineWidth = 3 * k; ctx.stroke();
    drawHub(cx, cy, k);
  }
  function drawHub(cx, cy, k) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 * k);
    g.addColorStop(0, cssVar("--hub-in", "#1a0030")); g.addColorStop(1, cssVar("--hub-out", "#06000e"));
    ctx.beginPath(); ctx.arc(cx, cy, 40 * k, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(167,139,250,0.35)"; ctx.lineWidth = 1.5 * k; ctx.stroke();
  }
  function emptyMessage() {
    if (!st.tasks.length) return ["Add tasks to begin", "your journey ✦"];
    if (!filtered().length) return ["No task matches", "your filters ✦"];
    return ["Every task has been chosen", "begin a new round ✦"];
  }

  /* ================= sound ================= */
  let actx = null;
  function tick(final) {
    if (!st.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = final ? "sine" : "triangle";
      o.frequency.value = final ? 880 : 1400 + Math.random() * 200;
      g.gain.setValueAtTime(final ? 0.18 : 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (final ? 0.9 : 0.05));
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + (final ? 0.95 : 0.06));
      if (final) {
        const o2 = actx.createOscillator(), g2 = actx.createGain();
        o2.frequency.value = 1318.5; g2.gain.setValueAtTime(0.12, t + 0.12); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o2.connect(g2).connect(actx.destination); o2.start(t + 0.12); o2.stop(t + 1.15);
      }
    } catch (e) {}
  }

  /* ================= spinning ================= */
  const rand = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
  const segmentAtPointer = (r) => {
    const a = (((-r) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return segs.findIndex((s) => a >= s.start && a < s.end);
  };

  function spin() {
    if (spinning) return;
    // the last winner stays drawn until the next spin; rebuild from the current pool so it can't win again
    segs = segments(pool());
    if (!segs.length) {
      if (st.tasks.length && filtered().length && st.settings.noRepeat) { toast("Every task has been chosen — starting a new round ✦"); newRound(); }
      else { toast(st.tasks.length ? "No task matches your filters ✦" : "Add tasks to the wheel first ✦"); return; }
      if (!segs.length) return;
    }
    spinning = true;
    highlight = null;
    hideResult();
    $("wheelHub").disabled = true;
    document.body.classList.remove("cheer");
    document.body.classList.add("casting");
    // choose the winner first (weighted, crypto random), then aim the wheel at it
    const total = segs.reduce((a, s) => a + (s.end - s.start), 0);
    let r = rand() * total, win = segs[segs.length - 1];
    for (const s of segs) { if (r < s.end - s.start) { win = s; break; } r -= s.end - s.start; }
    const span = win.end - win.start;
    const theta = win.start + span * (0.15 + rand() * 0.7);
    const TAU = Math.PI * 2;
    const start = rot;
    const delta = (((-theta - start) % TAU) + TAU) % TAU;
    const turns = reduceMotion ? 1 : 6 + Math.floor(rand() * 4);
    const target = start + turns * TAU + delta;
    const duration = reduceMotion ? 900 : 4200 + rand() * 1600;
    const t0 = performance.now();
    let lastIdx = segmentAtPointer(start);
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    function frame(now) {
      const p = Math.min(1, (now - t0) / duration);
      rot = start + (target - start) * ease(p);
      const idx = segmentAtPointer(rot);
      if (idx !== lastIdx) { lastIdx = idx; tick(false); }
      draw();
      if (p < 1) { requestAnimationFrame(frame); return; }
      rot = rot % TAU;
      st.rotation = rot;
      spinning = false;
      $("wheelHub").disabled = false;
      document.body.classList.remove("casting");
      document.body.classList.add("cheer");
      setTimeout(() => document.body.classList.remove("cheer"), 1800);
      highlight = win.task.id;
      draw();
      tick(true);
      land(win.task);
    }
    requestAnimationFrame(frame);
  }

  function land(task) {
    if (st.settings.noRepeat && !st.picked.includes(task.id)) st.picked.push(task.id);
    st.history.unshift({ id: task.id, name: task.name, at: Date.now(), outcome: "picked" });
    st.history = st.history.slice(0, 40);
    st.lastResult = task.id;
    save();
    showResult(task);
    renderSide();
    confetti();
  }

  function newRound() {
    st.picked = [];
    save();
    rebuild();
  }

  /* ================= result ================= */
  function showResult(t) {
    const chips = [];
    if (t.time) chips.push(`⏳ ${esc(t.time)}`);
    if (t.priority) chips.push(`✶ ${esc(t.priority)}`);
    t.category.forEach((c) => chips.push(`◇ ${esc(c)}`));
    t.routine.forEach((c) => chips.push(`☾ ${esc(c)}`));
    if (t.optional) chips.push("Optional");
    $("resultName").textContent = t.name;
    $("resultMeta").innerHTML = chips.map((c) => `<span class="meta-chip">${c}</span>`).join("");
    $("resultItemsSection").style.display = t.items.length ? "" : "none";
    $("resultItemsList").innerHTML = t.items.map((it) => `<span class="item-tag">◈ ${esc(it)}</span>`).join("");
    $("resultNotes").style.display = t.notes ? "" : "none";
    $("resultNotes").textContent = t.notes;
    $("resultLink").style.display = t.link ? "" : "none";
    $("resultLink").href = t.link || "#";
    $("resultSource").textContent = t.source ? `from ${t.source}` : "";
    $("resultCard").classList.add("visible");
    $("resultCard").dataset.id = t.id;
  }
  function hideResult() { $("resultCard").classList.remove("visible"); }

  function setOutcome(id, outcome) {
    const h = st.history.find((x) => x.id === id && x.outcome === "picked");
    if (h) h.outcome = outcome;
    save();
    renderSide();
  }

  /* ================= side panel ================= */
  function renderSide() {
    const list = filtered();
    const p = pool();
    const pickedSet = new Set(st.picked);
    $("taskCount").textContent = st.tasks.length;
    // pool info line
    const parts = [`<b>${p.length}</b> on the wheel`];
    if (list.length !== st.tasks.length) parts.push(`${st.tasks.length - list.length} filtered out`);
    if (st.settings.noRepeat && list.length - p.length > 0)
      parts.push(`${list.length - p.length} already chosen · <button class="link-btn" data-act="new-round">new round</button>`);
    $("poolInfo").innerHTML = (st.tasks.length ? parts.join(" · ") : "") +
      (p.length ? `<span class="spin-hint">✦ tap the golden seal, a sorcerer cat, or press Space to spin ✦</span>` : "");

    // task list
    const q = st.filters.search.toLowerCase();
    const shown = st.tasks.filter((t) => !q || t.name.toLowerCase().includes(q));
    $("taskList").innerHTML = shown.length
      ? shown.map((t, i) => {
          const inPool = matches(t);
          const chosen = st.settings.noRepeat && pickedSet.has(t.id);
          const col = COLORS[i % COLORS.length][1];
          const details = [];
          if (t.time) details.push(`⏳ ${esc(t.time)}`);
          if (t.priority) details.push(`✶ ${esc(t.priority)}`);
          if (t.category.length) details.push(`◇ ${esc(t.category.join(", "))}`);
          if (t.items.length) details.push(`◈ ${t.items.length} item${t.items.length > 1 ? "s" : ""}`);
          if (chosen) details.push("✓ chosen");
          return `<div class="task-item ${inPool ? "" : "out"} ${chosen ? "chosen" : ""}" style="border-left-color:${col}">
            <div class="task-info"><div class="task-name" title="${esc(t.name)}">${esc(t.name)}</div><div class="task-details">${details.map((d) => `<span>${d}</span>`).join("")}</div></div>
            <button class="delete-btn" data-act="delete" data-id="${t.id}" title="Remove" aria-label="Remove ${esc(t.name)}">✕</button></div>`;
        }).join("")
      : `<div class="empty-state"><span class="empty-state-icon">${TO.kitties ? TO.kitties.curled() : "🌀"}</span>${st.tasks.length ? "No task matches your search." : "No tasks yet — import your Notion export or add some by hand."}</div>`;

    // filters
    const facets = FACETS.map(({ key, label }) => {
      const vals = [...new Set(st.tasks.flatMap((t) => valuesOf(t, key)))].sort((a, b) => a.localeCompare(b));
      if (!vals.length || (key === "source" && vals.length < 2)) return "";
      const chips = vals.map((v) => {
        const on = st.filters[key].includes(v);
        const n = st.tasks.filter((t) => valuesOf(t, key).includes(v)).length;
        return `<button class="chip ${on ? "on" : ""}" data-act="facet" data-key="${key}" data-val="${esc(v)}">${esc(v)} <span>${n}</span></button>`;
      }).join("");
      return `<div class="facet"><label>${label}</label><div class="chips">${chips}</div></div>`;
    }).join("");
    const hasDays = st.tasks.some((t) => t.day.length);
    const hasTimes = st.tasks.some((t) => t.minutes != null);
    const active = FACETS.some(({ key }) => st.filters[key].length) || st.filters.maxMinutes || st.filters.today;
    $("filterBody").innerHTML = st.tasks.length
      ? `${hasTimes ? `<div class="facet"><label>Time I have</label><select id="maxMinutes" class="select">
            ${[[0, "Any amount"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [30, "30 minutes"], [45, "45 minutes"], [60, "1 hour"], [90, "1½ hours"], [120, "2 hours"], [180, "3 hours"]]
              .map(([v, l]) => `<option value="${v}" ${st.filters.maxMinutes === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>${st.filters.maxMinutes ? `<div class="hint">Tasks without a time block are hidden.</div>` : ""}</div>` : ""}
        ${hasDays ? `<label class="toggle-row"><input type="checkbox" id="todayOnly" ${st.filters.today ? "checked" : ""}/><span>Only today's tasks (${today()})</span></label>` : ""}
        ${facets}
        ${active ? `<button class="clear-btn" data-act="clear-filters">Clear filters</button>` : ""}
        ${!hasTimes && !hasDays && !facets.trim() ? `<div class="hint">These tasks have no time block, category, routine, tags, priority or day to filter by.</div>` : ""}`
      : `<div class="hint">Filters appear once the wheel has tasks.</div>`;
    $("filterBadge").textContent = active ? "on" : "";
    $("filterBadge").style.display = active ? "" : "none";

    // rules
    $("ruleNoRepeat").checked = st.settings.noRepeat;
    $("ruleWeighted").checked = st.settings.weighted;
    $("ruleSound").checked = st.settings.sound;
    applySky();

    // history
    $("historyList").innerHTML = st.history.length
      ? st.history.slice(0, 15).map((h) => {
          const d = new Date(h.at);
          const when = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          const icon = { done: "✓", skipped: "↷", picked: "✦" }[h.outcome] || "✦";
          return `<div class="hist-row ${h.outcome}"><span class="hist-icon">${icon}</span><span class="hist-name">${esc(h.name)}</span><span class="hist-when">${when}</span></div>`;
        }).join("")
      : `<div class="hint">Your chosen tasks will appear here.</div>`;
  }

  function rebuild() {
    segs = segments(pool());
    if (highlight && !segs.some((s) => s.task.id === highlight)) highlight = null;
    draw();
    renderSide();
  }

  /* ================= import ================= */
  async function importFile(file) {
    if (!file) return;
    let table;
    try { table = await IM.readFile(file); } catch (e) { toast(e.message || "Couldn't read that file"); return; }
    const source = IM.sourceName(file.name);
    const opts = { skipDone: true, skipHidden: true, onlyActive: false };
    const render = () => {
      const r = IM.fromTable(table, source, opts);
      const kind = { recurring: "Notion · Reoccurring tasks export", tasks: "Notion · Tasks export", legacy: "Simple list (Name, Time, Items, Notes)", generic: "Spreadsheet" }[r.kind];
      const sk = r.skipped;
      const skippedTxt = [sk.done && `${sk.done} done/cancelled`, sk.hidden && `${sk.hidden} hidden`, sk.inactive && `${sk.inactive} not active`, sk.empty && `${sk.empty} without a name`].filter(Boolean).join(", ");
      return { r, html: `
        <p class="modal-kind">${esc(kind)} · “${esc(source)}”</p>
        <p class="modal-count"><b>${r.tasks.length}</b> task${r.tasks.length === 1 ? "" : "s"} ready${skippedTxt ? ` · skipped ${skippedTxt}` : ""}</p>
        ${r.tasks.length ? `<div class="modal-preview">${r.tasks.slice(0, 8).map((t) => `<span class="item-tag">${esc(t.name)}</span>`).join("")}${r.tasks.length > 8 ? `<span class="hint">+${r.tasks.length - 8} more</span>` : ""}</div>` : ""}
        ${r.kind !== "legacy" ? `
          <label class="toggle-row"><input type="checkbox" data-opt="skipDone" ${opts.skipDone ? "checked" : ""}/><span>Skip tasks marked Done or Cancelled</span></label>
          <label class="toggle-row"><input type="checkbox" data-opt="skipHidden" ${opts.skipHidden ? "checked" : ""}/><span>Skip tasks with “Hide” ticked</span></label>
          ${r.columns.includes("status") ? `<label class="toggle-row"><input type="checkbox" data-opt="onlyActive" ${opts.onlyActive ? "checked" : ""}/><span>Only tasks with Status “Active”</span></label>` : ""}` : ""}
        <div class="modal-modes">
          <label class="toggle-row"><input type="radio" name="mode" value="add" checked/><span>Add to the wheel <em>(same name from the same file is updated)</em></span></label>
          <label class="toggle-row"><input type="radio" name="mode" value="replace"/><span>Replace everything on the wheel</span></label>
        </div>` };
    };
    let cur = render();
    const m = modal(`✦ Import “${esc(file.name)}”`, cur.html, [
      { label: "Cancel", cls: "ghost" },
      { label: "Add to wheel", cls: "primary", id: "importGo", onClick: (el) => {
        if (!cur.r.tasks.length) { toast("No tasks to import"); return false; }
        const mode = el.querySelector('input[name="mode"]:checked').value;
        applyImport(cur.r.tasks, mode);
      } },
    ]);
    m.el.addEventListener("change", (e) => {
      const o = e.target.dataset.opt;
      if (!o) return;
      opts[o] = e.target.checked;
      const mode = m.el.querySelector('input[name="mode"]:checked').value;
      cur = render();
      m.el.querySelector(".modal-body").innerHTML = cur.html;
      m.el.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
    });
  }

  function applyImport(tasks, mode) {
    let added = 0, updated = 0;
    if (mode === "replace") { st.tasks = []; st.picked = []; }
    tasks.forEach((t) => {
      const ex = st.tasks.find((x) => x.source === t.source && x.name.toLowerCase() === t.name.toLowerCase());
      if (ex) { Object.assign(ex, t, { id: ex.id }); updated++; }
      else { st.tasks.push(t); added++; }
    });
    save();
    rebuild();
    toast(`${added} added${updated ? `, ${updated} updated` : ""} ✦`);
  }

  /* ================= modal & toast ================= */
  function modal(title, body, buttons) {
    const wrap = document.createElement("div");
    wrap.className = "modal-overlay";
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-title">${title}</div><div class="modal-body">${body}</div>
      <div class="modal-actions">${buttons.map((b, i) => `<button class="mbtn ${b.cls || ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div></div>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelectorAll(".modal-actions .mbtn").forEach((b) => b.addEventListener("click", () => {
      const btn = buttons[+b.dataset.i];
      if (btn.onClick && btn.onClick(wrap) === false) return;
      close();
    }));
    return { el: wrap, close };
  }
  const confirmModal = (title, text, ok) => new Promise((res) => {
    let v = false;
    const m = modal(title, `<p>${text}</p>`, [{ label: "Cancel", cls: "ghost" }, { label: ok, cls: "danger", onClick: () => { v = true; } }]);
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); res(v); } });
    obs.observe(document.body, { childList: true });
  });

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ================= effects ================= */
  (function stars() {
    const c = $("stars");
    for (let i = 0; i < 130; i++) {
      const s = document.createElement("div");
      s.className = "star";
      const sz = Math.random() * 2.5 + 0.4;
      s.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random() * 100}%;left:${Math.random() * 100}%;--d:${(Math.random() * 4 + 2).toFixed(1)}s;--delay:-${(Math.random() * 5).toFixed(1)}s;--min-op:${(Math.random() * 0.25 + 0.04).toFixed(2)}`;
      c.appendChild(s);
    }
  })();
  function confetti() {
    if (reduceMotion) return;
    const palette = ["#a78bfa", "#c084fc", "#e2c97e", "#ddd6fe", "#7c3aed", "#f5e3a3", "#d8b4fe"];
    for (let i = 0; i < 60; i++) {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "confetti-piece";
        const sz = Math.random() * 9 + 4;
        el.style.cssText = `left:${Math.random() * 100}vw;top:-20px;width:${sz}px;height:${sz}px;background:${palette[(Math.random() * palette.length) | 0]};border-radius:${Math.random() > 0.5 ? "50%" : "2px"};--fall-duration:${(Math.random() * 2 + 1.5).toFixed(1)}s`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
      }, i * 28);
    }
  }

  /* ================= events ================= */
  $("wheelHub").addEventListener("click", spin);
  document.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.target.closest("input,textarea,select,button,a") && !document.querySelector(".modal-overlay")) {
      e.preventDefault();
      spin();
    }
  });

  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + b.dataset.tab));
  }));

  $("fileInput").addEventListener("change", (e) => { importFile(e.target.files[0]); e.target.value = ""; });
  const drop = $("dropZone");
  ["dragenter", "dragover"].forEach((ev) => document.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); drop.classList.add("dragover"); } }));
  ["dragleave", "drop"].forEach((ev) => document.addEventListener(ev, () => drop.classList.remove("dragover")));
  document.addEventListener("drop", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    importFile(e.dataTransfer.files[0]);
  });

  $("tab-manual").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("taskName").value.trim();
    if (!name) { toast("Please enter a task name ✦"); return; }
    st.tasks.push(IM.make({
      name, time: $("taskTime").value, source: "Manual",
      category: IM.splitList($("taskCategory").value), items: IM.splitList($("taskItems").value),
      priority: $("taskPriority").value, notes: $("taskNotes").value,
    }));
    e.target.reset();
    save();
    rebuild();
    toast("Task added to the wheel ✦");
  });

  $("templateBtn").addEventListener("click", () => {
    IM.write("Task Oracle - template", [
      IM.COLS,
      ["Refill napkin container", "5 m", "Cleaning", "Task", "Cleaning Routine", "Low", "Napkins", "", "", ""],
      ["Read a chapter", "30 m", "Literature", "", "Relaxing Routine", "Medium", "Book, Tea", "Any book from the shelf", "", ""],
      ["Gym session", "60 m", "Gym", "Exercise", "Gym Routine", "High", "Water bottle, Towel", "", "", "Sunday, Tuesday, Thursday"],
    ]);
  });
  $("exportBtn").addEventListener("click", () => {
    if (!st.tasks.length) { toast("The wheel is empty"); return; }
    IM.write("Task Oracle - tasks", IM.toRows(st.tasks));
  });

  $("taskSearch").addEventListener("input", (e) => { st.filters.search = e.target.value; renderSide(); });
  $("taskSearch").value = st.filters.search;

  ["ruleNoRepeat", "ruleWeighted", "ruleSound"].forEach((id) => $(id).addEventListener("change", (e) => {
    const k = { ruleNoRepeat: "noRepeat", ruleWeighted: "weighted", ruleSound: "sound" }[id];
    st.settings[k] = e.target.checked;
    save();
    rebuild();
  }));

  document.addEventListener("change", (e) => {
    if (e.target.id === "maxMinutes") { st.filters.maxMinutes = +e.target.value; save(); hideResult(); rebuild(); }
    if (e.target.id === "todayOnly") { st.filters.today = e.target.checked; save(); hideResult(); rebuild(); }
  });

  document.querySelectorAll(".sky-switch button").forEach((b) => b.addEventListener("click", () => {
    st.settings.sky = b.dataset.sky;
    save();
    applySky();
    draw();
  }));

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "facet") {
      const arr = st.filters[b.dataset.key];
      const i = arr.indexOf(b.dataset.val);
      if (i >= 0) arr.splice(i, 1); else arr.push(b.dataset.val);
      save(); hideResult(); rebuild();
    } else if (act === "clear-filters") {
      Object.assign(st.filters, { category: [], routine: [], tags: [], priority: [], source: [], maxMinutes: 0, today: false });
      save(); rebuild();
    } else if (act === "delete") {
      const id = b.dataset.id;
      st.tasks = st.tasks.filter((t) => t.id !== id);
      st.picked = st.picked.filter((x) => x !== id);
      if ($("resultCard").dataset.id === id) hideResult();
      save(); rebuild();
    } else if (act === "clear-all") {
      if (!st.tasks.length) return;
      if (!(await confirmModal("✦ Clear the wheel", "Remove all tasks from the wheel?", "Clear all"))) return;
      st.tasks = []; st.picked = [];
      save(); hideResult(); rebuild();
      toast("All tasks cleared ✦");
    } else if (act === "new-round") {
      newRound(); toast("A new round begins ✦");
    } else if (act === "clear-history") {
      st.history = []; save(); renderSide();
    } else if (act === "done") {
      setOutcome($("resultCard").dataset.id, "done");
      hideResult(); highlight = null; rebuild();
      toast("Fate fulfilled ✦");
    } else if (act === "again") {
      setOutcome($("resultCard").dataset.id, "skipped");
      rebuild();
      spin();
    } else if (act === "remove") {
      const id = $("resultCard").dataset.id;
      st.tasks = st.tasks.filter((t) => t.id !== id);
      st.picked = st.picked.filter((x) => x !== id);
      hideResult(); highlight = null; save(); rebuild();
      toast("Removed from the wheel ✦");
    } else if (act === "copy") {
      const name = $("resultName").textContent;
      try { await navigator.clipboard.writeText(name); toast("Task name copied ✦"); }
      catch (err) { toast("Copy isn't allowed here — select the name instead"); }
    }
  });

  window.addEventListener("resize", sizeCanvas);
  if (window.ResizeObserver) new ResizeObserver(sizeCanvas).observe(canvas);

  /* ================= init ================= */
  if (TO.kitties) TO.kitties.mount();
  segs = segments(pool());
  renderSide();
  sizeCanvas();
  if (st.lastResult) {
    const t = st.tasks.find((x) => x.id === st.lastResult);
    const h = st.history[0];
    if (t && h && h.id === t.id && h.outcome === "picked") { highlight = t.id; showResult(t); draw(); }
  }
  // redraw once the decorative fonts are ready so canvas labels use Cinzel
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  TO.app = { spin, state: () => st, rebuild, segments: () => segs, rotation: () => rot, segmentAtPointer }; // used by tests
})(window.TO);
