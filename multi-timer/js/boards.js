/* Multi Timer — board screen, drawer, element/board menus, edit-board mode, element catalog */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util, S = MT.store, E = MT.engine, UI = MT.ui, R = MT.render;
  const B = (MT.boards = {});
  const A = () => MT.app;

  /* ---------- board screen ---------- */
  B.header = () => {
    const b = S.activeBoard();
    if (A().editMode)
      return `<div class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-full">
        <div class="flex-1 min-w-0 font-bold font-display text-gray-700 dark:text-white truncate">${U.esc(b.name)}<span class="block text-[10px] text-brand font-semibold uppercase tracking-wide">Editing board · drag to reorder</span></div>
        <button class="mt-hbtn" data-h="cols" title="Columns"><i class="fa-solid fa-table-cells"></i><span class="text-xs ml-1 font-bold">${b.columns || "Auto"}</span></button>
        <button class="mt-hbtn" data-h="catalog" title="Add an element"><i class="fa-solid fa-circle-plus"></i></button>
        <button class="mt-btn mt-btn-ghost" data-h="edit-cancel">Cancel</button>
        <button class="mt-btn mt-btn-primary" data-h="edit-done">Done</button>
      </div>`;
    const running = b.elements.filter((e) => E.status(e) === "running").length;
    return `<div class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-full">
      <a href="../index.html" class="mt-hbtn" title="Back to Home"><i class="fa-solid fa-arrow-left"></i></a>
      <button class="mt-hbtn" data-h="drawer" title="Menu" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
      <div class="flex-1 min-w-0">
        <h1 class="font-bold text-gray-700 dark:text-white text-base sm:text-lg leading-tight truncate font-display">${U.esc(b.name)}</h1>
        <span class="text-[10px] text-brand font-semibold uppercase tracking-wide" id="board-sub">${b.elements.length} element${b.elements.length === 1 ? "" : "s"}${running ? ` · ${running} running` : ""}</span>
      </div>
      <button class="mt-hbtn" data-h="add" title="Add a timer" aria-label="Add a timer"><i class="fa-solid fa-plus"></i></button>
      <button class="mt-hbtn" data-h="import" title="Import spreadsheet" aria-label="Import spreadsheet"><i class="fa-solid fa-file-import"></i></button>
      <button class="mt-hbtn" data-h="board-menu" title="Board menu" aria-label="Board menu"><i class="fa-solid fa-ellipsis-vertical"></i></button>
    </div>`;
  };

  B.main = () => {
    const b = S.activeBoard();
    const now = Date.now();
    const tabs = S.state.boards.length > 1 && !A().editMode
      ? `<div class="mt-tabs">${S.state.boards.map((x) => `<button class="mt-tab ${x.id === b.id ? "active" : ""}" data-board="${x.id}">${U.esc(x.name)}</button>`).join("")}</div>`
      : "";
    if (!b.elements.length)
      return `<div class="p-3 sm:p-6 max-w-6xl mx-auto">${tabs}
        <div class="mt-empty">
          <div class="w-20 h-20 rounded-full bg-brandLight dark:bg-darkBorder text-brand flex items-center justify-center mb-4"><i class="fa-solid fa-stopwatch text-4xl"></i></div>
          <h2 class="text-xl font-bold font-display text-gray-800 dark:text-white mb-1">No timers on “${U.esc(b.name)}”</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">Create timers here, or import them from an Excel sheet, a CSV, a Notion database export, or a published Google Sheet.</p>
          <div class="flex flex-wrap gap-2 justify-center">
            <button class="mt-btn mt-btn-primary" data-h="add"><i class="fa-solid fa-plus mr-1"></i>Add a timer</button>
            <button class="mt-btn mt-btn-soft" data-h="import"><i class="fa-solid fa-file-import mr-1"></i>Import spreadsheet</button>
            <button class="mt-btn mt-btn-ghost" data-h="template"><i class="fa-solid fa-download mr-1"></i>Template</button>
          </div>
        </div></div>`;
    const banner = MT.notify && MT.notify.shouldPrompt()
      ? `<div class="mt-banner"><i class="fa-solid fa-bell text-brand"></i>
          <span class="flex-1 min-w-0">Get a desktop notification when a timer finishes.</span>
          <button class="mt-btn mt-btn-primary" data-h="notif-enable">Turn on</button>
          <button class="mt-btn mt-btn-ghost" data-h="notif-dismiss">Not now</button></div>`
      : "";
    return `<div class="p-3 sm:p-6 max-w-6xl mx-auto">${tabs}${banner}
      <div class="mt-grid ${A().editMode ? "editing" : ""}" id="mt-grid" style="${R.gridStyle(b)}">
        ${b.elements.map((el) => R.cell(el, now, A().editMode)).join("")}
      </div></div>`;
  };

  /* ---------- drawer ---------- */
  B.renderDrawer = () => {
    const d = document.getElementById("drawer-body");
    const editing = A().drawerEdit;
    const boards = S.state.boards.map((b, i) => editing
      ? `<div class="mt-drawer-item gap-1"><span class="flex-1 truncate">${U.esc(b.name)}</span>
          <button class="mt-icon-btn-sm" data-dr="up" data-id="${b.id}" ${i === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-arrow-up"></i></button>
          <button class="mt-icon-btn-sm" data-dr="rename" data-id="${b.id}" aria-label="Rename"><i class="fa-solid fa-pen"></i></button>
          <button class="mt-icon-btn-sm text-red-500" data-dr="delete" data-id="${b.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button></div>`
      : `<button class="mt-drawer-item ${b.id === S.state.activeBoardId && A().screen === "board" ? "active" : ""}" data-dr="board" data-id="${b.id}">
          <span class="flex-1 truncate text-left">${U.esc(b.name)}</span><span class="text-xs text-gray-400">${b.elements.length}</span></button>`).join("");
    d.innerHTML = `
      <div class="mt-drawer-section flex items-center justify-between"><span>Boards</span>
        <button class="text-brand text-xs font-bold normal-case tracking-normal" data-dr="edit">${editing ? "Done" : "Edit"}</button></div>
      ${boards}
      <button class="mt-drawer-item text-brand" data-dr="add"><i class="fa-solid fa-plus w-5"></i><span>New board</span></button>
      <div class="mt-drawer-section">Commands</div>
      <button class="mt-drawer-item" data-dr="reset-all"><i class="fa-solid fa-rotate-left w-5"></i><span>Reset all timers</span></button>
      <div class="mt-drawer-section">Data</div>
      <button class="mt-drawer-item" data-dr="import"><i class="fa-solid fa-file-import w-5"></i><span>Import spreadsheet / CSV</span></button>
      <button class="mt-drawer-item" data-dr="sources"><i class="fa-solid fa-link w-5"></i><span>Linked sheets (URL sync)</span></button>
      <button class="mt-drawer-item" data-dr="export-xlsx"><i class="fa-solid fa-file-excel w-5"></i><span>Export to Excel</span></button>
      <button class="mt-drawer-item" data-dr="export-mt"><i class="fa-solid fa-file-export w-5"></i><span>Export boards (.mt)</span></button>
      <div class="mt-drawer-section">App</div>
      <button class="mt-drawer-item ${A().screen === "history" ? "active" : ""}" data-dr="history"><i class="fa-solid fa-clock-rotate-left w-5"></i><span>History</span></button>
      <button class="mt-drawer-item ${A().screen === "settings" ? "active" : ""}" data-dr="settings"><i class="fa-solid fa-gear w-5"></i><span>Settings</span></button>
      <button class="mt-drawer-item" data-dr="dark"><i class="fa-solid fa-circle-half-stroke w-5"></i><span>Toggle dark mode</span></button>`;
  };

  B.openDrawer = (open = true) => {
    A().drawerOpen = open;
    A().drawerEdit = false;
    document.getElementById("drawer").classList.toggle("open", open);
    document.getElementById("drawer-backdrop").classList.toggle("open", open);
    if (open) B.renderDrawer();
  };

  B.onDrawerClick = async (e) => {
    const t = e.target.closest("[data-dr]");
    if (!t) return;
    const id = t.dataset.id;
    switch (t.dataset.dr) {
      case "board":
        S.state.activeBoardId = id;
        S.save();
        A().go("board");
        B.openDrawer(false);
        break;
      case "edit": A().drawerEdit = !A().drawerEdit; B.renderDrawer(); break;
      case "up": {
        const i = S.state.boards.findIndex((b) => b.id === id);
        if (i > 0) { S.checkpoint(); [S.state.boards[i - 1], S.state.boards[i]] = [S.state.boards[i], S.state.boards[i - 1]]; S.save(); }
        B.renderDrawer(); A().render();
        break;
      }
      case "rename": await B.renameBoard(id); B.renderDrawer(); break;
      case "delete": await B.deleteBoard(id); B.renderDrawer(); break;
      case "add": {
        const name = await UI.prompt("New board", "", { placeholder: "Board name" });
        if (name && name.trim()) {
          S.checkpoint();
          const b = S.addBoard(name.trim());
          S.state.activeBoardId = b.id;
          S.save();
          B.openDrawer(false);
          A().go("board");
        }
        break;
      }
      case "reset-all": B.openDrawer(false); B.resetAll(); break;
      case "import": B.openDrawer(false); MT.io.pickFile(); break;
      case "sources": B.openDrawer(false); MT.io.sourcesDialog(); break;
      case "export-xlsx": B.openDrawer(false); MT.io.exportExcel(); break;
      case "export-mt": B.openDrawer(false); MT.io.exportBoardsDialog(); break;
      case "history": B.openDrawer(false); MT.history.open(); break;
      case "settings": B.openDrawer(false); A().go("settings"); break;
      case "dark": MT.settings.toggleDark(); break;
    }
  };

  /* ---------- board actions ---------- */
  B.renameBoard = async (id) => {
    const b = S.board(id);
    const name = await UI.prompt("Board name", b.name);
    if (name && name.trim() && name.trim() !== b.name) {
      S.checkpoint();
      b.name = name.trim();
      S.save();
      A().render();
    }
  };
  B.deleteBoard = async (id) => {
    const b = S.board(id);
    if (await UI.confirm(`Delete board “${U.esc(b.name)}” and its ${b.elements.length} element(s)? You can restore it from Settings → Deleted data.`, { okLabel: "Delete board", danger: true })) {
      b.elements.forEach((el) => E.stopRinging(el.id));
      S.deleteBoard(id);
      A().go("board");
      UI.toast("Board deleted");
    }
  };
  B.resetAll = async () => {
    if (!(await UI.confirm("Reset every timer on every board?", { okLabel: "Reset all" }))) return;
    const now = Date.now();
    S.allElements().forEach(({ el }) => { if (E.hasRuntime(el) && (el.rt.status !== "inactive" || el.type === "counter")) E.reset(el, now); });
    A().render();
    UI.toast("All timers reset");
  };

  B.boardMenu = (anchor) => {
    const b = S.activeBoard();
    UI.menuAt(anchor, [
      { label: "Rename board", icon: "font", onClick: () => B.renameBoard(b.id) },
      { label: "Edit board", icon: "grip", onClick: () => B.enterEdit() },
      { label: "Add a timer", icon: "circle-plus", onClick: () => B.catalog() },
      "-",
      { label: "Import spreadsheet", icon: "file-import", onClick: () => MT.io.pickFile() },
      { label: "Export to Excel", icon: "file-excel", onClick: () => MT.io.exportExcel([b.id]) },
      { label: "Web Share", icon: "link", onClick: () => MT.io.webShare(b.id) },
      { label: "Export", icon: "arrow-up-from-bracket", onClick: () => MT.io.exportBoardsDialog(b.id) },
      { label: "Copy board", icon: "copy", onClick: () => { const nb = S.copyBoard(b.id); S.state.activeBoardId = nb.id; S.save(); A().render(); UI.toast("Board copied"); } },
      { label: "Undo last action", icon: "rotate-left", disabled: !S.canUndo(), onClick: () => { if (S.undo()) { A().render(); UI.toast("Undone"); } } },
      "-",
      { label: "Delete board", icon: "trash", danger: true, onClick: () => B.deleteBoard(b.id) },
    ]);
  };

  /* ---------- catalog ---------- */
  B.catalog = (boardId = S.state.activeBoardId) => {
    const types = Object.keys(S.TYPE_INFO);
    const o = UI.dialog({
      title: "Timers",
      wide: true,
      body: `<p class="mt-sub mb-3">Tap an element to add it to the current board.</p>
        <div class="flex flex-col gap-1">${types.map((t) => `
          <button class="mt-catalog-item" data-type="${t}">
            <span class="mt-catalog-icon"><i class="fa-solid fa-${S.TYPE_INFO[t].icon}"></i></span>
            <span class="flex-1 text-left"><span class="block font-semibold text-gray-800 dark:text-white">${S.TYPE_INFO[t].label}</span>
            <span class="mt-sub block">${S.TYPE_INFO[t].desc}</span></span>
          </button>`).join("")}</div>`,
      buttons: [{ label: "Close", kind: "ghost" }],
    });
    o.el.querySelectorAll("[data-type]").forEach((b) =>
      b.addEventListener("click", () => {
        o.close();
        MT.editor.open({ type: b.dataset.type }, { boardId, isNew: true });
      })
    );
  };

  /* ---------- element menus ---------- */
  B.elementMenu = (id, x, y) => {
    const f = S.find(id);
    if (!f) return;
    const el = f.el;
    const now = () => Date.now();
    const items = [];
    if (A().editMode) {
      items.push({ label: "Edit", icon: "wrench", onClick: () => MT.editor.open(el) });
      items.push(...structuralItems(el));
      UI.menu(x, y, items);
      return;
    }
    const t = E.target(el);
    if (el.type === "container") {
      items.push({ label: t ? "Change timer" : "Choose timer", icon: "box-open", onClick: () => B.chooseContainerRef(el) });
    }
    if (t && E.hasRuntime(t)) {
      const st = t.rt.status;
      if (t.type === "counter") {
        items.push({ label: "Increase", icon: "plus", onClick: () => E.counterStep(t, 1, now()) });
        items.push({ label: "Decrease", icon: "minus", onClick: () => E.counterStep(t, -1, now()) });
      } else if (st === "inactive" || st === "completed") {
        items.push({ label: "Start", icon: "play", onClick: () => A().startElement(t) });
        if (E.isSegmented(t)) items.push({ label: "Delay", icon: "hourglass-start", onClick: () => B.delayPrompt(t) });
      } else if (st === "running") items.push({ label: "Pause", icon: "pause", onClick: () => E.pause(t, now()) });
      else if (st === "waiting") items.push({ label: t.rt.delayUntil ? "Start now" : "Continue", icon: "play", onClick: () => E.resume(t, now()) });
      if (t.type === "stopwatch" && st === "running") items.push({ label: "Lap", icon: "flag", onClick: () => E.lap(t, now()) });
      if ((E.isSegmented(t) || t.type === "countup" || t.type === "stopwatch") && (t.addTimeButtons || []).length && st !== "inactive")
        t.addTimeButtons.forEach((ms) => items.push({ label: `${ms > 0 ? "Add" : "Subtract"} ${U.fmtHuman(Math.abs(ms))}`, icon: ms > 0 ? "plus" : "minus", onClick: () => E.addTime(t, ms, now()) }));
      if (st !== "inactive" || t.type === "counter") items.push({ label: "Reset", icon: "rotate-left", onClick: () => E.reset(t, now()) });
      items.push("-");
      items.push({ label: "History", icon: "list", onClick: () => MT.history.openFor(t.id) });
    }
    if (el.type !== "buttons") items.push({ label: "Single view", icon: "eye", onClick: () => A().openSingle(el.id) });
    items.push({ label: "Edit", icon: "wrench", onClick: () => MT.editor.open(el) });
    items.push(...structuralItems(el));
    UI.menu(x, y, items);
  };

  function structuralItems(el) {
    return [
      { label: "Copy", icon: "copy", onClick: () => { S.copyElement(el.id); A().render(); } },
      { label: "Move to board", icon: "right-left", disabled: S.state.boards.length < 2, onClick: () => B.moveToBoard(el.id) },
      { label: "Delete", icon: "trash", danger: true, onClick: () => { E.stopRinging(el.id); S.deleteElement(el.id); A().render(); UI.toast("Deleted — Undo is in the board menu"); } },
    ];
  }

  B.moveToBoard = async (id) => {
    const f = S.find(id);
    const opts = S.state.boards.filter((b) => b.id !== f.board.id).map((b) => ({ value: b.id, label: b.name }));
    const to = await UI.choose("Move to board", opts);
    if (to) { S.moveElement(id, to); A().render(); UI.toast("Moved"); }
  };

  B.delayPrompt = async (el) => {
    const ms = await UI.keypad("Delay start by", { initial: 5 * U.MIN });
    if (ms) E.delay(el, Math.abs(ms), Date.now());
  };

  B.chooseContainerRef = async (el) => {
    const opts = MT.editor.timerOptions(el.id);
    if (!opts.length) { UI.toast("Create a timer first", "error"); return; }
    const v = await UI.choose("Timer", opts, el.ref);
    if (v) { S.checkpoint(); el.ref = v; S.save(); A().render(); }
  };

  /* ---------- edit-board mode ---------- */
  B.enterEdit = () => {
    A().editMode = true;
    A().editSnap = JSON.stringify(S.activeBoard());
    A().render();
  };
  B.exitEdit = (commit) => {
    if (!commit && A().editSnap) {
      const snap = JSON.parse(A().editSnap);
      const b = S.activeBoard();
      if (b && b.id === snap.id) {
        const live = new Map(b.elements.map((e) => [e.id, e.rt]));
        snap.elements.forEach((e) => { if (live.has(e.id)) e.rt = live.get(e.id); });
        b.elements = snap.elements;
        b.columns = snap.columns;
        // undo deletes/moves made during this edit session
        const ids = new Set(snap.elements.map((e) => e.id));
        S.state.trash = S.state.trash.filter((t) => !(t.kind === "element" && ids.has(t.data.id)));
        S.state.boards.forEach((ob) => { if (ob.id !== b.id) ob.elements = ob.elements.filter((e) => !ids.has(e.id)); });
      }
    } else if (commit && A().editSnap) {
      // make the whole edit session one undo step
      const prevBoards = S.state.boards.map((b) => (b.id === JSON.parse(A().editSnap).id ? JSON.parse(A().editSnap) : b));
      S.undoStack.push(JSON.stringify({ boards: prevBoards, activeBoardId: S.state.activeBoardId, trash: S.state.trash }));
    }
    A().editMode = false;
    A().editSnap = null;
    S.save();
    A().render();
  };
  B.cycleColumns = () => {
    const b = S.activeBoard();
    const seq = [0, 2, 3, 4, 5, 6];
    b.columns = seq[(seq.indexOf(b.columns || 0) + 1) % seq.length];
    A().render();
  };

  /** Live reorder while dragging (pointer-based, works with touch). */
  B.dragOver = (dragId, x, y) => {
    const over = document.elementFromPoint(x, y)?.closest(".mt-cell");
    if (!over || over.dataset.id === dragId) return;
    const b = S.activeBoard();
    const from = b.elements.findIndex((e) => e.id === dragId);
    const to = b.elements.findIndex((e) => e.id === over.dataset.id);
    if (from < 0 || to < 0) return;
    const [m] = b.elements.splice(from, 1);
    b.elements.splice(to, 0, m);
    const grid = document.getElementById("mt-grid");
    const nodes = [...grid.children];
    const dragNode = nodes.find((n) => n.dataset.id === dragId);
    if (from < to) over.after(dragNode); else over.before(dragNode);
  };
})(window.MT);
