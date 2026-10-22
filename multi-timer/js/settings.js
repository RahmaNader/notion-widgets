/* Multi Timer — settings screens, theme, wake lock, notifications */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util, S = MT.store, UI = MT.ui;
  const ST = (MT.settings = { page: null });
  const A = () => MT.app;
  const set = () => S.state.settings;

  /* ---------- theme (shared keys with the home page) ---------- */
  ST.applyTheme = () => {
    const mode = localStorage.theme;
    const dark = mode === "dark" || (!mode && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    const color = localStorage.getItem("colorTheme") || "purple";
    document.documentElement.removeAttribute("data-theme");
    if (color !== "purple") document.documentElement.setAttribute("data-theme", color);
  };
  ST.appearance = () => localStorage.theme || "system";
  ST.setAppearance = (m) => {
    if (m === "system") localStorage.removeItem("theme");
    else localStorage.theme = m;
    ST.applyTheme();
  };
  ST.toggleDark = () => ST.setAppearance(document.documentElement.classList.contains("dark") ? "light" : "dark");
  ST.setColor = (c) => { localStorage.setItem("colorTheme", c); ST.applyTheme(); };

  /* ---------- wake lock ---------- */
  let lock = null;
  ST.updateWakeLock = async () => {
    const mode = set().display;
    const anyRunning = S.allElements().some(({ el }) => el.rt && el.rt.status === "running");
    const want = document.visibilityState === "visible" && (mode === "always" || (mode === "running" && anyRunning));
    try {
      if (want && !lock && navigator.wakeLock) {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => (lock = null));
      } else if (!want && lock) {
        await lock.release();
        lock = null;
      }
    } catch (e) { lock = null; }
  };

  /* ---------- notifications ---------- */
  ST.notify = (title, body) => {
    if (!set().statusNotifications || !("Notification" in window) || Notification.permission !== "granted") return;
    try { new Notification(title, { body, tag: "multi-timer-" + title, renotify: true }); } catch (e) {}
  };

  /* ---------- pages ---------- */
  const PAGES = [
    { id: "appearance", title: "Appearance", sub: () => `${({ system: "System", light: "Light", dark: "Dark" })[ST.appearance()]} theme`, icon: "palette" },
    { id: "display", title: "Display settings", sub: () => ({ system: "Uses system auto-lock settings", always: "Will always keep screen on", running: "Keeps the screen on while a timer runs" })[set().display], icon: "display" },
    { id: "controls", title: "Controls", sub: () => "Customize timer controls", icon: "hand-pointer" },
    { id: "alerts", title: "Alert settings", sub: () => "Customize timer end alerts", icon: "bell" },
    { id: "sounds", title: "Sounds", sub: () => "Manage alert sounds and the default beeper", icon: "music" },
    { id: "history", title: "History", sub: () => "Customize timer history settings", icon: "clock-rotate-left" },
    { id: "optional", title: "Optional settings", sub: () => "Additional features that don't fit other categories", icon: "sliders" },
    { id: "data", title: "Import & export", sub: () => "Excel, CSV, Notion CSV, linked sheets, backups", icon: "file-excel" },
    { id: "trash", title: "Deleted data", sub: () => "View and restore deleted boards and timers", icon: "trash-can-arrow-up" },
  ];

  ST.header = () => {
    const p = PAGES.find((x) => x.id === ST.page);
    return `<div class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-full">
      <button class="mt-hbtn" data-h="settings-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
      <h1 class="flex-1 font-bold text-gray-700 dark:text-white text-base sm:text-lg truncate font-display">${p ? p.title : "Settings"}</h1>
      ${ST.page === "sounds" ? `<button class="mt-hbtn" data-h="sound-add" title="Add a sound file"><i class="fa-solid fa-plus"></i></button>` : ""}
    </div>`;
  };
  ST.back = () => {
    if (ST.page) { ST.page = null; A().render(); }
    else A().go("board");
  };

  const row = (title, sub, attrs, right = '<i class="fa-solid fa-chevron-right text-gray-300"></i>') =>
    `<button class="mt-list-row" ${attrs}><span class="flex-1 text-left min-w-0"><span class="block font-medium">${title}</span>${sub ? `<span class="mt-sub block">${sub}</span>` : ""}</span>${right}</button>`;
  const toggle = (title, sub, key) =>
    `<label class="mt-list-row cursor-pointer"><span class="flex-1 min-w-0 pr-3"><span class="block font-medium">${title}</span>${sub ? `<span class="mt-sub block">${sub}</span>` : ""}</span>${UI.switch("st-" + key, set()[key], `data-setting="${key}"`)}</label>`;
  const radios = (key, opts, current) => opts.map((o) =>
    `<button class="mt-list-row" data-radio="${key}" data-value="${o.value}"><span class="mt-radio ${o.value === current ? "on" : ""} mr-3"></span><span class="flex-1 text-left"><span class="block font-medium">${o.label}</span>${o.sub ? `<span class="mt-sub block">${o.sub}</span>` : ""}</span></button>`).join("");
  const card = (inner, title = "") => `${title ? `<div class="mt-section-title px-1">${title}</div>` : ""}<div class="mt-card mb-4">${inner}</div>`;

  ST.main = () => {
    let h = "";
    switch (ST.page) {
      case null:
        h = card(PAGES.map((p) => row(`<i class="fa-solid fa-${p.icon} w-6 text-brand"></i>${p.title}`, `<span class="ml-6">${p.sub()}</span>`, `data-page="${p.id}"`)).join(""));
        h += `<p class="mt-sub text-center">Multi Timer · data is stored in this browser</p>`;
        break;
      case "appearance": {
        const color = localStorage.getItem("colorTheme") || "purple";
        h = card(radios("appearance", [{ value: "system", label: "System theme" }, { value: "light", label: "Light theme" }, { value: "dark", label: "Dark theme" }], ST.appearance()), "Theme");
        h += card(`<div class="flex gap-3 p-4">${[["purple", "#a855f7"], ["blue", "#3b82f6"], ["orange", "#f97316"], ["green", "#22c55e"]]
          .map(([n, c]) => `<button class="mt-swatch ${color === n ? "active" : ""}" style="--c:${c}" data-color-theme="${n}" aria-label="${n}"></button>`).join("")}</div>`, "Accent color (shared with your other widgets)");
        break;
      }
      case "display":
        h = card(radios("display", [
          { value: "system", label: "Uses system auto-lock settings" },
          { value: "always", label: "Will always keep screen on" },
          { value: "running", label: "Will keep the display on while the timer's running" },
        ], set().display));
        if (!("wakeLock" in navigator)) h += `<p class="mt-sub px-1">This browser doesn't support keeping the screen on.</p>`;
        break;
      case "controls":
        h = card(toggle("Reset timer by double tapping", "Lets you reset a timer to zero or its preset time with a double tap.", "doubleTapReset") +
          toggle("Enter a name for Quick Timer on start", "If the Quick Timer has no name set, a dialog to enter a name will appear after it starts. The name is cleared after the timer is reset.", "quickNamePrompt"));
        break;
      case "alerts":
        h = card(`<div class="p-4 border-b border-gray-100 dark:border-darkBorder"><div class="font-medium mb-2">Audio volume</div>
            <div class="flex items-center gap-3"><i class="fa-solid fa-volume-low text-gray-400"></i><input type="range" min="0" max="1" step="0.05" value="${set().volume}" id="st-volume" class="flex-1 accent-[var(--brand-color)]"/><i class="fa-solid fa-volume-high text-gray-400"></i></div>
            <div class="flex gap-2 mt-3"><button class="mt-btn mt-btn-soft" data-st="vol-test"><i class="fa-solid fa-play mr-1"></i>Test</button><button class="mt-btn mt-btn-ghost" data-st="vol-reset">Reset</button></div></div>` +
          toggle("Show status notifications", "Browser notifications when a timer ends, plus the running timer's countdown in the tab title.", "statusNotifications") +
          toggle("Show full-screen alert", "A full-screen alert with stop, snooze and reset buttons when a timer ends.", "fullScreenAlert"));
        if ("Notification" in window && Notification.permission === "denied")
          h += `<p class="mt-sub px-1">Notifications are blocked for this site in your browser settings.</p>`;
        h += `<p class="mt-sub px-1">Alerts play while this page (or the Notion page embedding it) is open.</p>`;
        break;
      case "sounds": {
        const q = (ST.soundQuery || "").toLowerCase();
        const list = MT.sounds.list().filter((s) => !q || s.name.toLowerCase().includes(q));
        h = `<div class="relative mb-3"><i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i><input id="st-sound-q" class="mt-input pl-9" placeholder="Search sounds" value="${U.esc(ST.soundQuery || "")}"/></div>`;
        h += card(list.map((s) => `<div class="mt-list-row">
            <button class="mt-radio ${set().defaultSound === s.id ? "on" : ""} mr-3" data-snd-default="${s.id}" title="Use as default" aria-label="Use as default"></button>
            <span class="flex-1 min-w-0"><span class="block font-medium truncate">${U.esc(s.name)}</span><span class="mt-sub">${s.custom ? "Custom file" : s.dur ? `${Math.round(s.dur)}s` : ""}${set().defaultSound === s.id ? " · default" : ""}</span></span>
            ${s.id !== "silent" ? `<button class="mt-icon-btn-sm" data-snd-play="${s.id}" aria-label="Play"><i class="fa-solid fa-play"></i></button>` : ""}
            ${s.custom ? `<button class="mt-icon-btn-sm" data-snd-rename="${s.id}" aria-label="Rename"><i class="fa-solid fa-pen"></i></button><button class="mt-icon-btn-sm text-red-500" data-snd-del="${s.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>` : ""}
          </div>`).join(""));
        h += `<button class="mt-btn mt-btn-soft w-full" data-h="sound-add"><i class="fa-solid fa-plus mr-1"></i>Add a sound file (mp3, wav, ogg…)</button>`;
        break;
      }
      case "history":
        h = card(radios("keepHistory", [
          { value: "forever", label: "Forever" }, { value: "1y", label: "1 year" }, { value: "6m", label: "6 months" },
          { value: "3m", label: "3 months" }, { value: "1m", label: "1 month" }, { value: "1w", label: "1 week" },
        ], set().keepHistory), "Keep records");
        h += card(row("Open history", `${S.state.history.length} records`, 'data-st="open-history"') +
          row('<span class="text-red-500">Clear all history</span>', "", 'data-st="clear-history"', ""));
        break;
      case "optional":
        h = card(toggle("Waiting animation", "Enable a pulse animation when the timer is waiting to resume or when it's stopped.", "waitingAnimation"));
        break;
      case "data":
        h = card(
          row("Import spreadsheet", "Excel (.xlsx/.xls), CSV, Notion database CSV, or a .mt backup", 'data-st="import"') +
          row("Linked sheets (URL sync)", `${S.state.sources.length} linked · Google Sheets, OneDrive, any CSV link`, 'data-st="sources"') +
          row("Download Excel template", "Example rows for every timer type", 'data-st="template"') +
          row("Export to Excel", "All boards, same columns as the template (re-importable)", 'data-st="export-xlsx"') +
          row("Export boards (.mt)", "Full backup of selected boards", 'data-st="export-mt"')
        );
        h += card(row('<span class="text-red-500">Erase all data</span>', "Boards, timers, history and settings in this browser", 'data-st="erase"', ""));
        break;
      case "trash":
        h = S.state.trash.length
          ? card(S.state.trash.map((t, i) => `<div class="mt-list-row">
              <i class="fa-solid ${t.kind === "board" ? "fa-table-cells-large" : "fa-stopwatch"} w-6 text-gray-400"></i>
              <span class="flex-1 min-w-0"><span class="block font-medium truncate">${U.esc(t.kind === "board" ? t.data.name : S.elementLabel(t.data))}</span>
              <span class="mt-sub">${t.kind === "board" ? `Board · ${t.data.elements.length} elements` : `${S.TYPE_INFO[t.data.type]?.label} · from ${U.esc(t.boardName || "")}`} · ${U.fmtDateTime(t.deletedAt)}</span></span>
              <button class="mt-btn mt-btn-soft" data-trash-restore="${i}">Restore</button>
              <button class="mt-icon-btn-sm text-red-500 ml-1" data-trash-del="${i}" aria-label="Delete forever"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join("")) + `<button class="mt-btn mt-btn-danger w-full" data-st="empty-trash">Empty deleted data</button>`
          : card(`<p class="mt-sub text-center py-10">Nothing deleted.</p>`);
        break;
    }
    return `<div class="p-3 sm:p-6 max-w-2xl mx-auto">${h}</div>`;
  };

  let preview = null;
  ST.onClick = async (e) => {
    const t = e.target;
    const page = t.closest("[data-page]");
    if (page) { ST.page = page.dataset.page; A().render(); return; }
    const radio = t.closest("[data-radio]");
    if (radio) {
      const k = radio.dataset.radio, v = radio.dataset.value;
      if (k === "appearance") ST.setAppearance(v);
      else { set()[k] = v; S.save(); }
      if (k === "display") ST.updateWakeLock();
      if (k === "keepHistory") S.pruneHistory();
      A().render();
      return;
    }
    const ct = t.closest("[data-color-theme]");
    if (ct) { ST.setColor(ct.dataset.colorTheme); A().render(); return; }
    const sd = t.closest("[data-snd-default]");
    if (sd) { set().defaultSound = sd.dataset.sndDefault; S.save(); A().render(); return; }
    const sp = t.closest("[data-snd-play]");
    if (sp) { preview && preview.stop(); preview = MT.sounds.play(sp.dataset.sndPlay, { repeat: 1 }); return; }
    const sdel = t.closest("[data-snd-del]");
    if (sdel) {
      if (await UI.confirm("Delete this sound?", { okLabel: "Delete", danger: true })) {
        await MT.sounds.removeCustom(sdel.dataset.sndDel);
        if (set().defaultSound === sdel.dataset.sndDel) set().defaultSound = "alarm";
        A().render();
      }
      return;
    }
    const sren = t.closest("[data-snd-rename]");
    if (sren) {
      const s = S.state.customSounds.find((x) => x.id === sren.dataset.sndRename);
      const n = await UI.prompt("Sound name", s.name);
      if (n && n.trim()) { s.name = n.trim(); S.save(); A().render(); }
      return;
    }
    const tr = t.closest("[data-trash-restore]");
    if (tr) { S.restoreTrash(+tr.dataset.trashRestore); UI.toast("Restored"); A().render(); return; }
    const td = t.closest("[data-trash-del]");
    if (td) { S.state.trash.splice(+td.dataset.trashDel, 1); S.save(); A().render(); return; }
    const st = t.closest("[data-st]");
    if (!st) return;
    switch (st.dataset.st) {
      case "vol-test": preview && preview.stop(); preview = MT.sounds.play(set().defaultSound, { repeat: 1 }); break;
      case "vol-reset": set().volume = 0.8; S.save(); A().render(); break;
      case "open-history": MT.history.open(); break;
      case "clear-history":
        if (await UI.confirm("Delete all history records?", { okLabel: "Delete", danger: true })) { S.state.history = []; S.save(); A().render(); }
        break;
      case "import": MT.io.pickFile(); break;
      case "sources": MT.io.sourcesDialog(); break;
      case "template": MT.io.downloadTemplate(); break;
      case "export-xlsx": MT.io.exportExcel(); break;
      case "export-mt": MT.io.exportBoardsDialog(); break;
      case "empty-trash":
        if (await UI.confirm("Permanently delete everything in Deleted data?", { okLabel: "Delete forever", danger: true })) { S.state.trash = []; S.save(); A().render(); }
        break;
      case "erase":
        if (await UI.confirm("Erase all Multi Timer data in this browser? Export a backup first if you need one.", { okLabel: "Erase everything", danger: true })) {
          localStorage.removeItem(S.KEY);
          S.load();
          S.undoStack = [];
          MT.engine.ringing.forEach((r, id) => MT.engine.stopRinging(id));
          A().go("board");
        }
        break;
    }
  };

  ST.onChange = async (e) => {
    const t = e.target;
    if (t.dataset.setting) {
      const k = t.dataset.setting;
      set()[k] = t.checked;
      S.save();
      if (k === "statusNotifications" && t.checked && "Notification" in window && Notification.permission === "default") {
        const p = await Notification.requestPermission();
        if (p !== "granted") UI.toast("Notifications were not allowed — tab title updates still work", "error");
      }
      if (k === "statusNotifications" && !t.checked) document.title = A().baseTitle;
      if (k === "waitingAnimation") A().render();
    }
  };
  ST.onInput = (e) => {
    if (e.target.id === "st-volume") { set().volume = +e.target.value; S.save(); }
    if (e.target.id === "st-sound-q") {
      ST.soundQuery = e.target.value;
      const pos = e.target.selectionStart;
      A().render();
      const q = document.getElementById("st-sound-q");
      q.focus();
      q.setSelectionRange(pos, pos);
    }
  };

  ST.addSound = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "audio/*";
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) { UI.toast("File is larger than 15 MB", "error"); return; }
      try {
        const meta = await MT.sounds.addCustom(f);
        UI.toast(`Added “${meta.name}”`);
        A().render();
      } catch (err) {
        UI.toast("Could not store the sound in this browser", "error");
      }
    };
    inp.click();
  };
})(window.MT);
