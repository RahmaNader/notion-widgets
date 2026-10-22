/* Multi Timer — history screens (boards → timers → day-grouped records) */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util, S = MT.store, UI = MT.ui;
  const H = (MT.history = { level: "boards", boardId: null, elId: null, edit: false, from: "board" });
  const A = () => MT.app;
  const OTHERS = "__others__";

  H.open = () => {
    Object.assign(H, { level: "boards", boardId: null, elId: null, edit: false, from: A().screen === "history" ? H.from : A().screen });
    A().go("history");
  };
  H.openFor = (elId) => {
    const f = S.find(elId);
    Object.assign(H, { level: "records", elId, boardId: f ? f.board.id : OTHERS, edit: false, from: A().screen, direct: true });
    A().go("history");
  };

  const recordsFor = (elId) => S.state.history.filter((r) => r.el === elId);
  const liveIds = () => new Set(S.allElements().map(({ el }) => el.id));

  H.back = () => {
    H.edit = false;
    if (H.level === "records" && !H.direct) H.level = "timers";
    else if (H.level === "timers") H.level = "boards";
    else { H.direct = false; A().go(H.from === "history" ? "board" : H.from || "board"); return; }
    A().render();
  };

  H.header = () => {
    let title = "History";
    if (H.level === "timers") title = H.boardId === OTHERS ? "Others" : U.esc(S.board(H.boardId)?.name || "History");
    if (H.level === "records") {
      const f = S.find(H.elId);
      const r = recordsFor(H.elId)[0];
      title = U.esc(f ? S.elementLabel(f.el) : r ? r.name : "History");
    }
    return `<div class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-full">
      <button class="mt-hbtn" data-h="hist-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
      <div class="flex-1 min-w-0"><h1 class="font-bold text-gray-700 dark:text-white text-base sm:text-lg truncate font-display">${title}</h1>
        <span class="text-[10px] text-brand font-semibold uppercase tracking-wide">History</span></div>
      <button class="mt-hbtn" data-h="hist-export" title="Export history" aria-label="Export history"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
      ${H.level === "records" ? `<button class="mt-btn ${H.edit ? "mt-btn-primary" : "mt-btn-ghost"}" data-h="hist-edit">${H.edit ? "Done" : "Edit"}</button>` : ""}
    </div>`;
  };

  H.main = () => {
    const wrap = (inner) => `<div class="p-3 sm:p-6 max-w-2xl mx-auto"><div class="mt-card">${inner}</div></div>`;
    const empty = (msg) => `<p class="mt-sub text-center py-10">${msg}</p>`;
    if (H.level === "boards") {
      const ids = liveIds();
      const orphan = S.state.history.some((r) => !ids.has(r.el));
      const rows = S.state.boards.map((b) => {
        const n = S.state.history.filter((r) => b.elements.some((e) => e.id === r.el)).length;
        return `<button class="mt-list-row" data-hist-board="${b.id}"><span class="flex-1 text-left font-medium">${U.esc(b.name)}</span><span class="mt-sub">${n} record${n === 1 ? "" : "s"}</span><i class="fa-solid fa-chevron-right text-gray-300 ml-2"></i></button>`;
      }).join("");
      return wrap(rows + (orphan ? `<button class="mt-list-row" data-hist-board="${OTHERS}"><span class="flex-1 text-left font-medium">Others</span><span class="mt-sub">deleted timers</span><i class="fa-solid fa-chevron-right text-gray-300 ml-2"></i></button>` : ""));
    }
    if (H.level === "timers") {
      let items;
      if (H.boardId === OTHERS) {
        const ids = liveIds();
        const seen = new Map();
        S.state.history.filter((r) => !ids.has(r.el)).forEach((r) => seen.set(r.el, { id: r.el, name: r.name, type: r.type }));
        items = [...seen.values()];
      } else {
        const b = S.board(H.boardId);
        items = (b ? b.elements : []).filter((e) => MT.engine.hasRuntime(e)).map((e) => ({ id: e.id, name: S.elementLabel(e), type: e.type, color: e.color }));
      }
      if (!items.length) return wrap(empty("No timers on this board."));
      return wrap(items.map((it) => {
        const recs = recordsFor(it.id);
        const total = recs.reduce((a, r) => a + r.dur, 0);
        return `<button class="mt-list-row" data-hist-el="${it.id}">
          ${it.color ? `<span class="w-2.5 h-2.5 rounded-full mr-3 shrink-0" style="background:${it.color}"></span>` : ""}
          <span class="flex-1 text-left min-w-0"><span class="block font-medium truncate">${U.esc(it.name)}</span><span class="mt-sub">${S.TYPE_INFO[it.type]?.label || ""}</span></span>
          <span class="text-right"><span class="block text-sm font-semibold">${recs.length ? U.fmtHuman(total) : ""}</span><span class="mt-sub">${recs.length} record${recs.length === 1 ? "" : "s"}</span></span>
          <i class="fa-solid fa-chevron-right text-gray-300 ml-2"></i></button>`;
      }).join(""));
    }
    // records
    const recs = recordsFor(H.elId).sort((a, b) => b.start - a.start);
    if (!recs.length) return wrap(empty("No history yet. Records appear when a timer finishes or is reset."));
    const days = new Map();
    recs.forEach((r) => {
      const k = U.dayKey(r.start);
      if (!days.has(k)) days.set(k, []);
      days.get(k).push(r);
    });
    let h = "";
    days.forEach((list) => {
      const total = list.reduce((a, r) => a + r.dur, 0);
      h += `<div class="mt-hist-day">
        <div class="mt-hist-head"><span>Started</span><span class="flex-1 text-center">${U.fmtDay(list[0].start)}</span><span>Time</span></div>
        ${list.map((r) => `<div class="mt-hist-row">
            <span class="font-mono">${U.fmtClock(r.start)}</span>
            <span class="flex-1 text-center mt-sub truncate px-2">${r.label && r.label !== r.name ? U.esc(r.label) : ""}</span>
            <span class="font-mono">${r.partial ? '<span class="text-amber-500" title="Stopped before finishing">*</span> ' : ""}${U.fmtHuman(r.dur)}</span>
            ${H.edit ? `<button class="mt-icon-btn-sm text-red-500 ml-2" data-hist-del="${r.id}" aria-label="Delete record"><i class="fa-solid fa-trash"></i></button>` : ""}
          </div>`).join("")}
        <div class="mt-hist-total"><span>Total</span><span class="font-mono">${U.fmtHuman(total)}</span></div>
      </div>`;
    });
    if (H.edit) h += `<button class="mt-btn mt-btn-danger w-full mt-4" data-hist-clear>Delete all records of this timer</button>`;
    h += `<p class="mt-sub mt-3"><span class="text-amber-500">*</span> run stopped or reset before it finished.</p>`;
    return wrap(h);
  };

  H.onClick = async (e) => {
    const b = e.target.closest("[data-hist-board]");
    if (b) { H.boardId = b.dataset.histBoard; H.level = "timers"; A().render(); return; }
    const el = e.target.closest("[data-hist-el]");
    if (el) { H.elId = el.dataset.histEl; H.level = "records"; H.direct = false; A().render(); return; }
    const del = e.target.closest("[data-hist-del]");
    if (del) {
      S.state.history = S.state.history.filter((r) => r.id !== del.dataset.histDel);
      S.save();
      A().render();
      return;
    }
    if (e.target.closest("[data-hist-clear]")) {
      if (await UI.confirm("Delete all history records of this timer?", { okLabel: "Delete", danger: true })) {
        S.state.history = S.state.history.filter((r) => r.el !== H.elId);
        S.save();
        A().render();
      }
    }
  };

  H.export = () => {
    const recs = H.level === "records" ? recordsFor(H.elId) : S.state.history;
    if (!recs.length) { UI.toast("No history to export", "error"); return; }
    const rows = [["Board", "Timer", "Type", "Label", "Started", "Ended", "Duration", "Duration (seconds)", "Stopped early"]];
    recs.slice().sort((a, b) => a.start - b.start).forEach((r) => {
      const f = S.find(r.el);
      rows.push([f ? f.board.name : r.boardName || "", f ? S.elementLabel(f.el) : r.name, S.TYPE_INFO[r.type]?.label || r.type, r.label || "",
        U.fmtDateTime(r.start), r.end ? U.fmtDateTime(r.end) : "", U.fmtHuman(r.dur), Math.round(r.dur / 1000), r.partial ? "yes" : ""]);
    });
    MT.io.writeTable("MultiTimer - history", "History", rows);
  };
})(window.MT);
