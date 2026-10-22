/* Multi Timer — app shell: routing, gestures, tick loop, alarms, single view */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util, S = MT.store, E = MT.engine, UI = MT.ui, R = MT.render, B = MT.boards;
  const A = (MT.app = {
    screen: "board", editMode: false, editSnap: null, singleId: null, singleTab: "control",
    drawerOpen: false, drawerEdit: false, baseTitle: document.title,
  });
  const $ = (id) => document.getElementById(id);

  /* ---------- routing ---------- */
  A.go = (screen, params = {}) => {
    if (A.editMode && screen !== "board") B.exitEdit(true);
    A.screen = screen;
    Object.assign(A, params);
    if (screen === "settings" && !params.keepPage) MT.settings.page = null;
    $("app-main").scrollTop = 0;
    A.render();
  };

  A.render = () => {
    const head = $("app-header"), main = $("app-main");
    let h = "", m = "";
    switch (A.screen) {
      case "history": h = MT.history.header(); m = MT.history.main(); break;
      case "settings": h = MT.settings.header(); m = MT.settings.main(); break;
      case "single": {
        const f = S.find(A.singleId);
        if (!f) { A.screen = "board"; return A.render(); }
        h = singleHeader(f.el); m = singleMain(f.el);
        break;
      }
      default: h = B.header(); m = B.main();
    }
    head.innerHTML = h;
    const y = main.scrollTop;
    main.innerHTML = m;
    main.scrollTop = y;
    if (A.drawerOpen) B.renderDrawer();
    MT.settings.updateWakeLock();
  };

  let renderQueued = false;
  A.queueRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      if (dragging) return; // never rebuild the grid mid-drag
      A.render();
    });
  };

  /* ---------- starting (quick timer input) ---------- */
  A.startElement = async (el) => {
    const now = Date.now();
    if (el.type === "quick") {
      const ms = await UI.keypad(S.elementLabel(el) || "Quick timer", { initial: el.duration || 5 * U.MIN, okLabel: "Start" });
      if (!ms) return;
      let quickName;
      if (S.state.settings.quickNamePrompt && !el.name) {
        const n = await UI.prompt("Name this timer", "", { placeholder: "Optional", okLabel: "OK" });
        if (n && n.trim()) quickName = n.trim();
      }
      E.start(el, Date.now(), { duration: Math.abs(ms), quickName });
      return;
    }
    E.start(el, now);
  };

  /** Primary tap on an element. */
  A.tap = (id) => {
    const f = S.find(id);
    if (!f) return;
    const el = f.el;
    if (A.editMode) { MT.editor.open(el); return; }
    if (el.type === "clock") { A.openSingle(id); return; }
    if (el.type === "buttons") return;
    const t = E.target(el);
    if (!t) { B.chooseContainerRef(el); return; }
    if (E.ringing.has(t.id) && t.rt.status === "completed") { E.stopRinging(t.id); return; }
    if (E.ringing.has(t.id)) E.stopRinging(t.id);
    if ((t.rt.status === "inactive" || t.rt.status === "completed") && t.type === "quick") {
      if (t.rt.status === "completed") E.reset(t, Date.now());
      else A.startElement(t);
      return;
    }
    E.toggle(t, Date.now());
  };

  A.doubleTap = (id) => {
    const f = S.find(id);
    if (!f || A.editMode) return;
    const t = E.target(f.el);
    if (t && E.hasRuntime(t)) E.reset(t, Date.now());
  };

  /* ---------- gestures (tap / double-tap / long-press / drag) ---------- */
  let press = null, dragging = null, lastTap = { id: null, t: 0 };
  function onPointerDown(e) {
    if (e.button > 0) return;
    const cell = e.target.closest(".mt-cell");
    if (!cell || e.target.closest("[data-act]")) return;
    MT.sounds.unlock();
    press = { id: cell.dataset.id, x: e.clientX, y: e.clientY, long: false, pid: e.pointerId };
    press.timer = setTimeout(() => {
      if (!press) return;
      press.long = true;
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {}
      B.elementMenu(press.id, press.x, press.y);
    }, 520);
  }
  function onPointerMove(e) {
    if (!press) return;
    const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (dragging) {
      e.preventDefault();
      B.dragOver(dragging.id, e.clientX, e.clientY);
      return;
    }
    if (dist > 10) {
      clearTimeout(press.timer);
      if (A.editMode && !press.long && A.screen === "board") {
        dragging = { id: press.id };
        const node = document.querySelector(`.mt-cell[data-id="${press.id}"]`);
        node && node.classList.add("dragging");
        try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (er) {}
      } else press = null;
    }
  }
  function onPointerUp() {
    if (dragging) {
      document.querySelectorAll(".mt-cell.dragging").forEach((n) => n.classList.remove("dragging"));
      dragging = null;
      press = null;
      return;
    }
    if (!press) return;
    clearTimeout(press.timer);
    if (!press.long) {
      const id = press.id, now = Date.now();
      if (S.state.settings.doubleTapReset && lastTap.id === id && now - lastTap.t < 350) {
        lastTap = { id: null, t: 0 };
        A.doubleTap(id);
      } else {
        lastTap = { id, t: now };
        A.tap(id);
      }
    }
    press = null;
  }
  function onPointerCancel() {
    if (press) clearTimeout(press.timer);
    press = null;
    if (dragging) { document.querySelectorAll(".mt-cell.dragging").forEach((n) => n.classList.remove("dragging")); dragging = null; }
  }

  /* ---------- click delegation ---------- */
  function onMainClick(e) {
    const act = e.target.closest("[data-act]");
    if (act) {
      const cell = act.closest("[data-id]");
      const f = cell ? S.find(cell.dataset.id) : A.screen === "single" ? S.find(A.singleId) : null;
      const now = Date.now();
      const t = f && E.target(f.el);
      switch (act.dataset.act) {
        case "ctr-inc": t && E.counterStep(t, 1, now); break;
        case "ctr-dec": t && E.counterStep(t, -1, now); break;
        case "pill": {
          if (A.editMode) { MT.editor.open(f.el); break; }
          const btn = f.el.buttons[+act.dataset.bi];
          let n = 0;
          const snap = E.statusSnapshot();
          (btn.commands || []).forEach((c) => (n += E.runCommand(c, f.board.id, now, snap)));
          act.classList.add("pressed");
          setTimeout(() => act.classList.remove("pressed"), 180);
          if (!n) UI.toast("No timer matched this button's commands");
          break;
        }
        case "sv-toggle": t && (t.rt.status === "inactive" && t.type === "quick" ? A.startElement(t) : E.toggle(t, now)); break;
        case "sv-reset": t && E.reset(t, now); break;
        case "sv-add": t && E.addTime(t, +act.dataset.ms, now); break;
        case "sv-add-custom":
          UI.keypad("Add time", { allowNegative: true }).then((ms) => ms && t && E.addTime(t, ms, Date.now()));
          break;
        case "sv-lap": t && E.lap(t, now); break;
        case "sv-delay": t && B.delayPrompt(t); break;
        case "sv-tab": A.singleTab = act.dataset.tab; A.render(); break;
      }
      return;
    }
    const tab = e.target.closest("[data-board]");
    if (tab) { S.state.activeBoardId = tab.dataset.board; S.save(); A.render(); return; }
    const hd = e.target.closest("[data-h]");
    if (hd) return onHeaderAction(hd, e);
    if (A.screen === "history") MT.history.onClick(e);
    if (A.screen === "settings") MT.settings.onClick(e);
  }

  function onHeaderAction(btn) {
    switch (btn.dataset.h) {
      case "drawer": B.openDrawer(true); break;
      case "add": B.catalog(); break;
      case "import": MT.io.pickFile(); break;
      case "template": MT.io.downloadTemplate(); break;
      case "board-menu": B.boardMenu(btn); break;
      case "cols": B.cycleColumns(); break;
      case "catalog": B.catalog(); break;
      case "edit-cancel": B.exitEdit(false); break;
      case "edit-done": B.exitEdit(true); break;
      case "hist-back": MT.history.back(); break;
      case "hist-export": MT.history.export(); break;
      case "hist-edit": MT.history.edit = !MT.history.edit; A.render(); break;
      case "settings-back": MT.settings.back(); break;
      case "sound-add": MT.settings.addSound(); break;
      case "single-back": A.go("board"); break;
      case "single-menu": {
        const f = S.find(A.singleId);
        if (f) B.elementMenu(f.el.id, btn.getBoundingClientRect().right - 220, btn.getBoundingClientRect().bottom + 4);
        break;
      }
    }
  }

  /* ---------- single view ---------- */
  A.openSingle = (id) => { A.singleId = id; A.singleTab = "control"; A.go("single"); };

  function singleHeader(el) {
    return `<div class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-full">
      <button class="mt-hbtn" data-h="single-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
      <h1 class="flex-1 font-bold text-gray-700 dark:text-white text-base sm:text-lg truncate font-display">${U.esc(S.elementLabel(E.target(el) || el))}</h1>
      <button class="mt-hbtn" data-h="single-menu" aria-label="Menu"><i class="fa-solid fa-ellipsis-vertical"></i></button>
    </div>`;
  }

  function singleMain(el) {
    const now = Date.now();
    const t = E.target(el);
    const tabs = t && E.hasRuntime(t) ? ["control", "stats", "history"] : [];
    let content = "";
    if (t && A.singleTab === "control") content = singleControl(t);
    else if (t && A.singleTab === "stats") content = `<div id="sv-stats">${singleStats(t, now)}</div>`;
    else if (t && A.singleTab === "history") content = singleHistory(t);
    return `<div class="p-4 max-w-md mx-auto flex flex-col items-center">
      <div class="mt-cell mt-single w-full max-w-[340px]" data-id="${el.id}">${R.cellInner(el, now)}</div>
      ${tabs.length ? `<div class="mt-seg w-full mt-6">${tabs.map((x) => `<button class="${A.singleTab === x ? "active" : ""}" data-act="sv-tab" data-tab="${x}">${x}</button>`).join("")}</div>` : ""}
      <div class="w-full mt-4">${content}</div>
    </div>`;
  }

  function singleControl(t) {
    const st = t.rt.status;
    if (t.type === "counter")
      return `<div class="flex justify-center gap-6">
        <button class="mt-round-btn" data-act="ctr-dec" aria-label="Decrease"><i class="fa-solid fa-minus"></i></button>
        <button class="mt-round-btn" data-act="sv-reset" aria-label="Reset"><i class="fa-solid fa-rotate-left"></i></button>
        <button class="mt-round-btn primary" data-act="ctr-inc" aria-label="Increase"><i class="fa-solid fa-plus"></i></button></div>`;
    const adds = (t.addTimeButtons || []).map((ms) => `<button class="mt-chip" data-act="sv-add" data-ms="${ms}">${ms > 0 ? "+" : "−"}${U.fmtHuman(Math.abs(ms))}</button>`).join("");
    const playIcon = st === "running" ? "pause" : "play";
    let h = `<div class="flex justify-center flex-wrap gap-2 mb-5">${adds}<button class="mt-chip" data-act="sv-add-custom" aria-label="Add custom time">•••</button></div>
      <div class="flex justify-center items-center gap-6">
        ${E.isSegmented(t) && (st === "inactive" || st === "completed") ? `<button class="mt-round-btn" data-act="sv-delay" title="Delay start" aria-label="Delay start"><i class="fa-solid fa-hourglass-start"></i></button>` : ""}
        <button class="mt-round-btn primary big" data-act="sv-toggle" aria-label="${playIcon}"><i class="fa-solid fa-${playIcon}"></i></button>
        ${t.type === "stopwatch" && st === "running" ? `<button class="mt-round-btn" data-act="sv-lap" aria-label="Lap"><i class="fa-solid fa-flag"></i></button>` : ""}
        <button class="mt-round-btn" data-act="sv-reset" aria-label="Reset"><i class="fa-solid fa-rotate-left"></i></button>
      </div>`;
    if (t.type === "stopwatch" && t.rt.laps && t.rt.laps.length) {
      const laps = t.rt.laps;
      h += `<div class="mt-card mt-5"><div class="mt-hist-head"><span>Lap</span><span class="flex-1 text-center">Lap time</span><span>Split</span></div>${laps
        .map((v, i) => `<div class="mt-hist-row"><span>${i + 1}</span><span class="flex-1 text-center font-mono">${U.swText(v - (laps[i - 1] || 0))}</span><span class="font-mono">${U.swText(v)}</span></div>`)
        .reverse().join("")}</div>`;
    }
    if (t.note) h += `<div class="mt-card mt-5 p-4 text-sm whitespace-pre-wrap">${U.esc(t.note)}</div>`;
    return h;
  }

  function singleStats(t, now) {
    const rt = t.rt;
    const cell = (k, v) => `<div><div class="mt-sub uppercase tracking-wider text-[11px] font-bold">${k}</div><div class="font-mono text-sm mt-0.5">${v}</div></div>`;
    let rows = [];
    if (E.isSegmented(t)) {
      const active = rt.status !== "inactive" && !rt.delayUntil;
      const seg = E.seg(t, rt.segIndex);
      rows = [
        cell("Interval", active && E.segments(t).length > 1 ? `${U.esc(seg.name)} (${(rt.segIndex || 0) + 1}/${E.segments(t).length})` : "–"),
        cell("Cycle", active && E.cycles(t) > 1 ? `${(rt.cycle || 0) + 1}/${E.cycles(t)}` : rt.repeats ? `repeat ${rt.repeats}` : "–"),
        cell("Interval started", active && rt.segStartedAt ? U.fmtClock(rt.segStartedAt) : "-- : --"),
        cell("Interval ending", rt.status === "running" ? U.fmtClock(rt.endsAt) : rt.status === "completed" ? U.fmtClock(rt.finishedAt) : "-- : --"),
        cell("Elapsed", active ? U.plainTime(E.elapsed(t, now)) : "-- : --"),
        cell(rt.status === "completed" ? "Overtime" : "Remaining", active ? U.plainTime(Math.abs(E.remaining(t, now))) : "-- : --"),
      ];
      if (rt.delayUntil) rows.push(cell("Starts at", U.fmtClock(rt.delayUntil)));
    } else if (t.type === "countup" || t.type === "stopwatch") {
      rows = [
        cell("Started", rt.runStart ? U.fmtDateTime(rt.runStart) : "–"),
        cell("Elapsed", rt.status !== "inactive" ? U.plainTime(E.elapsed(t, now)) : "–"),
      ];
      if (t.type === "stopwatch") rows.push(cell("Laps", (rt.laps || []).length));
      if (t.type === "countup" && t.milestones.length) {
        const next = t.milestones.find((m) => !(rt.fired || []).includes(m));
        rows.push(cell("Next notification", next && rt.status !== "inactive" ? `in ${U.plainTime(next - E.elapsed(t, now))}` : "–"));
      }
    } else if (t.type === "counter") {
      rows = [cell("Count", rt.count ?? t.initial), cell("Target", t.final === "" ? "–" : t.final), cell("Step", t.step), cell("Started", rt.runStart ? U.fmtClock(rt.runStart) : "–")];
    }
    const total = S.state.history.filter((r) => r.el === t.id && U.dayKey(r.start) === U.dayKey(now)).reduce((a, r) => a + r.dur, 0);
    rows.push(cell("Today total", U.fmtHuman(total)));
    return `<div class="mt-card p-4 grid grid-cols-2 gap-4">${rows.join("")}</div>`;
  }

  function singleHistory(t) {
    const recs = S.state.history.filter((r) => r.el === t.id).sort((a, b) => b.start - a.start).slice(0, 60);
    if (!recs.length) return `<p class="mt-sub text-center py-6">No history yet.</p>`;
    let last = "", h = "";
    recs.forEach((r) => {
      const k = U.dayKey(r.start);
      if (k !== last) { h += `<div class="mt-sub font-bold mt-3 mb-1">${U.fmtDay(r.start)}</div>`; last = k; }
      const icon = r.kind === "finish" ? "flag-checkered" : "stop";
      h += `<div class="mt-hist-row"><span class="font-mono">${U.fmtClock(r.start)}</span><span class="flex-1 px-3 truncate"><i class="fa-solid fa-${icon} text-gray-400 mr-1"></i>${U.esc(r.label || r.name)}</span><span class="font-mono">${r.partial ? "* " : ""}${U.fmtHuman(r.dur)}</span></div>`;
    });
    return `<div class="mt-card px-4 pb-3">${h}</div><button class="mt-btn mt-btn-soft w-full mt-3" onclick="MT.history.openFor('${t.id}')">Open full history</button>`;
  }

  /* ---------- alarms ---------- */
  A.alarm = (el, opts = {}) => {
    if (opts.silent) return;
    const st = S.state.settings;
    const a = el.alert || {};
    const sound = a.sound || st.defaultSound;
    const label = S.elementLabel(el);
    E.stopRinging(el.id);
    const handle = MT.sounds.play(sound, { volume: st.volume, repeat: opts.short ? 1 : a.repeat ?? 1 });
    if (a.vibrate) MT.sounds.vibrate(opts.short ? [200] : [400, 200, 400, 200, 400]);
    MT.settings.notify(label, opts.label ? `Next: ${opts.label}` : "Time is up");
    if (opts.short) {
      UI.toast(`${label}: ${opts.label || "next"}`);
      E.ringing.set(el.id, { sound: handle, short: true });
      setTimeout(() => { const r = E.ringing.get(el.id); if (r && r.short) E.ringing.delete(el.id); }, 8000);
      return;
    }
    E.ringing.set(el.id, { sound: handle, at: Date.now() });
    if (st.fullScreenAlert) A.refreshAlertOverlay();
    else UI.toast(`${label} — time is up`);
  };

  let overlay = null;
  A.refreshAlertOverlay = () => {
    const ringing = [...E.ringing.entries()].filter(([, r]) => !r.short).map(([id]) => S.find(id)).filter(Boolean);
    if (!ringing.length || !S.state.settings.fullScreenAlert) {
      if (overlay) { overlay.remove(); overlay = null; }
      return;
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "mt-alert-overlay";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        const b = e.target.closest("[data-al]");
        if (!b) return;
        const now = Date.now();
        const id = b.dataset.id;
        const f = id && S.find(id);
        switch (b.dataset.al) {
          case "stop": E.stopRinging(id); break;
          case "reset": f && E.reset(f.el, now); break;
          case "add": f && E.addTime(f.el, +b.dataset.ms, now); break;
          case "restart": if (f) { E.reset(f.el, now, { log: false }); E.start(f.el, now); } break;
          case "all": [...E.ringing.keys()].forEach((k) => E.stopRinging(k)); break;
        }
        A.refreshAlertOverlay();
      });
    }
    overlay.innerHTML = `<div class="mt-alert-box">
      <div class="mt-alert-pulse"><i class="fa-solid fa-bell"></i></div>
      <h2 class="text-2xl font-bold font-display mb-4">Time is up</h2>
      <div class="w-full flex flex-col gap-3">${ringing.map(({ el }) => `
        <div class="mt-alert-item" style="--c:${el.color}">
          <div class="flex items-center gap-3 mb-3">${el.icon ? `<span class="mt-alert-icon"><i class="fa-solid fa-${U.esc(el.icon)}"></i></span>` : ""}<span class="font-bold text-lg truncate">${U.esc(S.elementLabel(el))}</span></div>
          <div class="flex flex-wrap gap-2">
            <button class="mt-btn mt-btn-primary" data-al="stop" data-id="${el.id}"><i class="fa-solid fa-bell-slash mr-1"></i>Stop</button>
            ${E.isSegmented(el) ? (el.addTimeButtons || []).filter((v) => v > 0).slice(0, 2).map((ms) => `<button class="mt-btn mt-btn-soft" data-al="add" data-ms="${ms}" data-id="${el.id}">+${U.fmtHuman(ms)}</button>`).join("") : ""}
            ${E.isSegmented(el) && el.type !== "quick" ? `<button class="mt-btn mt-btn-soft" data-al="restart" data-id="${el.id}"><i class="fa-solid fa-rotate-right mr-1"></i>Restart</button>` : ""}
            <button class="mt-btn mt-btn-ghost" data-al="reset" data-id="${el.id}">Reset</button>
          </div>
        </div>`).join("")}</div>
      ${ringing.length > 1 ? `<button class="mt-btn mt-btn-ghost mt-4" data-al="all">Stop all</button>` : ""}
    </div>`;
  };

  /* ---------- tick ---------- */
  function updateTitle(now) {
    if (!S.state.settings.statusNotifications) return;
    const running = S.allElements().map(({ el }) => el).filter((el) => E.isSegmented(el) && el.rt.status === "running").sort((a, b) => a.rt.endsAt - b.rt.endsAt)[0];
    const t = running ? `▶ ${U.plainTime(running.rt.endsAt - now)} ${S.elementLabel(running)} · Multi Timer` : A.baseTitle;
    if (document.title !== t) document.title = t;
  }

  function tick() {
    const now = Date.now();
    E.tickAll(now);
    const main = $("app-main");
    if (A.screen === "board" || A.screen === "single") R.patch(main, now);
    if (A.screen === "single" && A.singleTab === "stats") {
      const st = $("sv-stats");
      const f = S.find(A.singleId);
      const t = f && E.target(f.el);
      if (st && t) st.innerHTML = singleStats(t, now);
    }
    if (A.screen === "board") {
      const sub = $("board-sub");
      const b = S.activeBoard();
      if (sub) {
        const running = b.elements.filter((e) => E.status(e) === "running").length;
        const txt = `${b.elements.length} element${b.elements.length === 1 ? "" : "s"}${running ? ` · ${running} running` : ""}`;
        if (sub.textContent !== txt) sub.textContent = txt;
      }
    }
    updateTitle(now);
  }

  /* ---------- boot ---------- */
  A.boot = () => {
    MT.settings.applyTheme();
    S.load();
    E.onAlarm = A.alarm;
    E.onChange = () => { A.queueRender(); MT.settings.updateWakeLock(); };
    // catch up timers that finished while the page was closed (silently: >10s late)
    E.tickAll(Date.now());

    const main = $("app-main");
    main.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    main.addEventListener("contextmenu", (e) => {
      const cell = e.target.closest(".mt-cell");
      if (!cell) return;
      e.preventDefault();
      if (press) { clearTimeout(press.timer); press = null; }
      B.elementMenu(cell.dataset.id, e.clientX, e.clientY);
    });
    main.addEventListener("click", onMainClick);
    main.addEventListener("keydown", (e) => {
      const cell = e.target.closest(".mt-cell");
      if (!cell || e.target !== cell) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); A.tap(cell.dataset.id); }
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { const r = cell.getBoundingClientRect(); B.elementMenu(cell.dataset.id, r.left + 20, r.top + 20); }
    });
    main.addEventListener("change", (e) => A.screen === "settings" && MT.settings.onChange(e));
    main.addEventListener("input", (e) => A.screen === "settings" && MT.settings.onInput(e));
    $("app-header").addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (b) onHeaderAction(b, e); });
    $("drawer").addEventListener("click", B.onDrawerClick);
    $("drawer-backdrop").addEventListener("click", () => B.openDrawer(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && A.drawerOpen) B.openDrawer(false); });
    document.addEventListener("pointerdown", () => MT.sounds.unlock(), { once: true });
    document.addEventListener("visibilitychange", () => { MT.settings.updateWakeLock(); if (document.visibilityState === "hidden") S.saveNow(); });
    window.addEventListener("pagehide", S.saveNow);
    window.addEventListener("storage", (e) => { if (e.key === "theme" || e.key === "colorTheme") MT.settings.applyTheme(); });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", MT.settings.applyTheme);
    window.addEventListener("hashchange", MT.io.checkHashImport);

    A.render();
    setInterval(tick, 100);
    MT.io.checkHashImport();
    MT.io.autoSync();
  };

  document.addEventListener("DOMContentLoaded", A.boot);
})(window.MT);
