/* Multi Timer — element editor sheet */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util, S = MT.store, E = MT.engine, UI = MT.ui;
  const ED = (MT.editor = {});

  const EXTRA = [
    { value: "overtime", label: "Overtime", sub: "Shows time since completion" },
    { value: "elapsed", label: "Elapsed time", sub: "Shows time since start" },
    { value: "start", label: "Start time" },
    { value: "finish", label: "Finish time" },
    { value: "none", label: "None" },
  ];
  const UNITS = [
    { value: "auto", label: "Automatic", sub: "MM:SS, hours and days when needed" },
    { value: "hms", label: "Hours, minutes, seconds" },
    { value: "ms", label: "Minutes and seconds" },
  ];
  const ACTIONS = [
    { value: "start", label: "Start" },
    { value: "delay", label: "Delay" },
    { value: "pause", label: "Pause" },
    { value: "continue", label: "Continue" },
    { value: "addTime", label: "Add time" },
    { value: "reset", label: "Reset" },
  ];
  const STATUSES = [
    { value: "any", label: "Any" },
    { value: "inactive", label: "Inactive" },
    { value: "running", label: "Running" },
    { value: "waiting", label: "Waiting" },
    { value: "completed", label: "Completed" },
  ];
  ED.ACTIONS = ACTIONS;
  ED.STATUSES = STATUSES;

  const row = (title, sub, act, right = '<i class="fa-solid fa-chevron-right text-gray-300"></i>') =>
    `<button type="button" class="mt-row" data-ed="${act}"><span class="flex-1 min-w-0 text-left"><span class="mt-row-title">${title}</span>${sub ? `<span class="mt-sub block truncate">${sub}</span>` : ""}</span>${right}</button>`;
  const toggleRow = (title, sub, id, checked) =>
    `<label class="mt-row cursor-pointer"><span class="flex-1 min-w-0"><span class="mt-row-title">${title}</span>${sub ? `<span class="mt-sub block">${sub}</span>` : ""}</span>${UI.switch(id, checked, `data-bool="${id.replace("ed-", "")}"`)}</label>`;
  const numRow = (title, field, value, attrs = "") =>
    `<label class="mt-row"><span class="flex-1 mt-row-title">${title}</span><input type="number" class="mt-input w-28 text-right" data-num="${field}" value="${U.esc(value)}" ${attrs}/></label>`;
  const section = (title) => `<div class="mt-section-title">${title}</div>`;

  const alertSub = (d) => {
    const a = d.alert || {};
    const snd = MT.sounds.name(a.sound || S.state.settings.defaultSound);
    const rep = a.repeat === 0 ? "until stopped" : `${a.repeat || 1}×`;
    return `${U.esc(snd)}, ${rep}${a.vibrate ? ", vibrate" : ""}`;
  };
  const addTimeSub = (d) => {
    const v = d.addTimeButtons || [];
    if (v.length === 2 && v[0] === U.MIN && v[1] === 5 * U.MIN) return "Default (+1m, +5m)";
    return v.length ? v.map((x) => (x > 0 ? "+" : "") + U.fmtHuman(x)).join(", ") : "None";
  };

  ED.timerOptions = (excludeId) => {
    const opts = [];
    S.state.boards.forEach((b) =>
      b.elements.filter((e) => E.hasRuntime(e) && e.id !== excludeId).forEach((e) =>
        opts.push({ value: e.id, label: S.elementLabel(e), sub: `${b.name} · ${S.TYPE_INFO[e.type].label}`, color: e.color, board: b.name })
      )
    );
    return opts;
  };

  /** Opens the editor. `el` is an existing element, or { type, boardId } to create one. */
  ED.open = (el, { boardId, isNew = false } = {}) => {
    const d = isNew ? S.createElement(el.type) : U.clone(el);
    if (isNew) d.color = U.paletteColor((S.board(boardId) || S.activeBoard()).elements.length + 3);
    if (isNew && d.type === "quick") d.name = "";
    const typeLabel = S.TYPE_INFO[d.type].label;
    const segmented = E.isSegmented(d);
    const hasAlert = segmented || ["countup", "counter"].includes(d.type);

    const body = () => {
      let h = `<div class="max-w-xl mx-auto w-full pb-24">`;
      // colors
      h += `<div class="mt-swatches mb-2">${U.PALETTE.map((p) => `<button type="button" class="mt-swatch ${d.color === p.hex ? "active" : ""}" data-color="${p.hex}" style="--c:${p.hex}" aria-label="${p.name}"></button>`).join("")}
        ${S.state.customColors.map((c) => `<button type="button" class="mt-swatch ${d.color === c ? "active" : ""}" data-color="${c}" style="--c:${c}"></button>`).join("")}
        <button type="button" class="mt-swatch custom ${![...U.PALETTE.map((p) => p.hex), ...S.state.customColors].includes(d.color) ? "active" : ""}" data-ed="color" style="--c:${d.color}" aria-label="Custom color"><i class="fa-solid fa-eye-dropper"></i></button></div>`;
      // icon + name
      if (d.type !== "buttons")
        h += `<div class="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-darkBorder">
          <button type="button" class="mt-icon-pick" data-ed="icon" style="--c:${d.color}" aria-label="Choose icon">${d.icon ? `<i class="fa-solid fa-${U.esc(d.icon)}"></i>` : `<i class="fa-regular fa-image opacity-50"></i>`}</button>
          <input class="mt-name-input" data-text="name" style="color:${d.color}" value="${U.esc(d.name)}" placeholder="${d.type === "quick" ? "Name (optional)" : "Add label"}" maxlength="60"/>
        </div>`;
      h += `<div class="mt-sub mt-2 mb-1">${typeLabel}</div>`;

      // type specific
      switch (d.type) {
        case "countdown":
          h += row("Time", U.fmtHuman(d.duration), "duration");
          h += toggleRow("Auto-repeat", "The timer will automatically repeat an unlimited number of times", "ed-autoRepeat", d.autoRepeat);
          h += row("Units of time", UNITS.find((u) => u.value === d.units)?.label, "units");
          break;
        case "quick":
          h += `<p class="mt-sub py-2">A quick timer has no preset — you set the time when it starts.${S.state.settings.quickNamePrompt ? " You'll also be asked for a name." : ""}</p>`;
          h += row("Units of time", UNITS.find((u) => u.value === d.units)?.label, "units");
          break;
        case "interval":
          h += section("Intervals");
          h += d.intervals.map((iv, i) => `
            <div class="mt-row gap-2">
              <button type="button" class="w-6 h-6 rounded-full shrink-0 border-2 border-white dark:border-darkSurface shadow" style="background:${iv.color || d.color}" data-ed="iv-color" data-i="${i}" aria-label="Interval color"></button>
              <input class="mt-input flex-1 min-w-0" data-iv-name="${i}" value="${U.esc(iv.name)}" placeholder="Interval name"/>
              <button type="button" class="mt-chip" data-ed="iv-dur" data-i="${i}">${U.fmtHuman(iv.duration)}</button>
              <button type="button" class="mt-icon-btn-sm" data-ed="iv-up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-arrow-up"></i></button>
              <button type="button" class="mt-icon-btn-sm text-red-500" data-ed="iv-del" data-i="${i}" aria-label="Remove"><i class="fa-solid fa-trash"></i></button>
            </div>`).join("");
          h += `<button type="button" class="mt-btn mt-btn-soft w-full my-2" data-ed="iv-add"><i class="fa-solid fa-plus mr-1"></i>Add interval</button>`;
          h += numRow("Repetitions", "repeats", d.repeats, 'min="1" max="999"');
          h += toggleRow("Wait for me between intervals", "Pause before each next interval until you tap continue", "ed-pauseBetween", d.pauseBetween);
          h += toggleRow("Auto-repeat", "Start over after the last repetition", "ed-autoRepeat", d.autoRepeat);
          break;
        case "pomodoro":
          h += row("Work", U.fmtHuman(d.work), "p-work");
          h += row("Short break", U.fmtHuman(d.shortBreak), "p-shortBreak");
          h += row("Long break", U.fmtHuman(d.longBreak), "p-longBreak");
          h += numRow("Work sessions before long break", "sessions", d.sessions, 'min="1" max="20"');
          h += toggleRow("Wait for me between intervals", "Pause before each break and work session", "ed-pauseBetween", d.pauseBetween);
          h += toggleRow("Auto-repeat", "Start a new set after the long break", "ed-autoRepeat", d.autoRepeat);
          break;
        case "countup":
          h += `<label class="mt-row"><span class="flex-1"><span class="mt-row-title">Count from</span><span class="mt-sub block">Leave empty to count from when you press start</span></span>
            <input type="datetime-local" class="mt-input w-52" data-text="startFrom" value="${U.esc(d.startFrom)}"/></label>`;
          h += section("Notifications");
          h += `<div class="flex flex-wrap gap-2 py-2">${(d.milestones || []).map((m, i) => `<span class="mt-chip">${U.fmtHuman(m)} <button type="button" data-ed="ms-del" data-i="${i}" class="ml-1 text-red-500" aria-label="Remove">×</button></span>`).join("") || '<span class="mt-sub">No notifications</span>'}</div>`;
          h += `<button type="button" class="mt-btn mt-btn-soft w-full mb-2" data-ed="ms-add"><i class="fa-solid fa-bell mr-1"></i>Notify me after…</button>`;
          h += row("Units of time", UNITS.find((u) => u.value === d.units)?.label, "units");
          break;
        case "stopwatch":
          h += `<p class="mt-sub py-2">Record laps from the long-press menu or the single view.</p>`;
          break;
        case "counter":
          h += numRow("Initial value", "initial", d.initial);
          h += numRow("Final value", "final", d.final);
          h += numRow("Step", "step", d.step, 'min="1"');
          break;
        case "clock": {
          let zones = [];
          try { zones = Intl.supportedValuesOf("timeZone"); } catch (e) { zones = ["UTC", "Africa/Cairo", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Tokyo"]; }
          h += `<label class="mt-row"><span class="flex-1 mt-row-title">Time zone</span><select class="mt-input w-56" data-text="tz"><option value="">Local time</option>${zones.map((z) => `<option ${z === d.tz ? "selected" : ""}>${z}</option>`).join("")}</select></label>`;
          h += toggleRow("12-hour format", "", "ed-hour12", d.hour12);
          h += toggleRow("Show seconds", "", "ed-seconds", d.seconds);
          h += row("Dial style", d.dial === "analog" ? "Analog" : "Digital", "dial");
          break;
        }
        case "buttons":
          h += `<p class="mt-sub py-2">You can add up to three buttons. Each button runs its commands on the timers you pick.</p>`;
          h += (d.buttons || []).map((b, i) => `
            <div class="mt-row gap-2">
              <button type="button" class="mt-pill flex-1" style="--c:${b.color}" data-ed="bt-edit" data-i="${i}">${U.esc(b.label || `Button (${i})`)}</button>
              <button type="button" class="mt-icon-btn-sm" data-ed="bt-up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-arrow-up"></i></button>
              <button type="button" class="mt-icon-btn-sm text-red-500" data-ed="bt-del" data-i="${i}" aria-label="Remove"><i class="fa-solid fa-trash"></i></button>
            </div>`).join("");
          h += `<button type="button" class="mt-btn mt-btn-soft w-full my-2" data-ed="bt-add" ${(d.buttons || []).length >= 3 ? "disabled" : ""}><i class="fa-solid fa-plus mr-1"></i>Add button</button>`;
          break;
        case "container": {
          const f = d.ref && S.find(d.ref);
          h += row("Timer", f ? `${U.esc(S.elementLabel(f.el))} · ${U.esc(f.board.name)}` : "None selected", "ref");
          break;
        }
      }

      // common
      if (segmented) h += toggleRow("Autocompletion", "The timer will be automatically reset when finished", "ed-autoComplete", d.autoComplete);
      if (hasAlert) h += row("Alert", alertSub(d), "alert");
      if (segmented || d.type === "countup") h += row("Extra info", EXTRA.find((x) => x.value === d.extraInfo)?.label, "extra");
      if (segmented || d.type === "countup" || d.type === "stopwatch") h += row("Add time buttons", addTimeSub(d), "addtime");
      h += `<label class="block py-3 border-b border-gray-100 dark:border-darkBorder"><span class="mt-row-title">Note</span>
        <textarea class="mt-input mt-1 min-h-[70px]" data-text="note" placeholder="Add a note">${U.esc(d.note)}</textarea></label>`;
      if (!isNew && E.hasRuntime(d)) h += row("History", "History of timer work", "history");
      if (!isNew) h += `<button type="button" class="mt-row text-red-500" data-ed="delete"><span class="flex-1 text-left mt-row-title text-red-500"><i class="fa-solid fa-trash mr-2"></i>Delete</span></button>`;
      h += `</div>`;
      return h;
    };

    const sheet = UI.sheet({
      title: isNew ? `New ${typeLabel.toLowerCase()}` : U.esc(S.elementLabel(el) || typeLabel),
      body: body(),
      onDone: () => save(),
      onMount: (root) => wire(root),
    });
    const bodyEl = sheet.el.querySelector(".mt-sheet-body");
    const redraw = () => {
      const y = bodyEl.scrollTop;
      bodyEl.innerHTML = body();
      bodyEl.scrollTop = y;
    };

    function save() {
      if (d.type === "countdown" && !(d.duration > 0)) { UI.toast("Set a time first", "error"); return false; }
      if (d.type === "interval" && !E.segments(d).length) { UI.toast("Add at least one interval with a time", "error"); return false; }
      if (d.type === "pomodoro" && !(d.work > 0)) { UI.toast("Set the work time", "error"); return false; }
      if (d.type === "counter") {
        d.initial = Number(d.initial) || 0;
        d.step = Math.abs(Number(d.step)) || 1;
        d.final = d.final === "" || d.final == null ? "" : Number(d.final);
      }
      d.name = (d.name || "").trim();
      if (!d.name && d.type !== "quick") d.name = typeLabel;
      if (isNew) {
        S.checkpoint();
        const b = S.board(boardId) || S.activeBoard();
        d.rt = d.type === "counter" ? { status: "inactive", count: d.initial } : { status: "inactive" };
        b.elements.push(d);
      } else {
        const f = S.find(el.id);
        if (!f) return;
        S.checkpoint();
        const rt = f.el.rt;
        Object.keys(f.el).forEach((k) => delete f.el[k]);
        Object.assign(f.el, d, { id: el.id, rt });
        if (f.el.type === "counter" && rt.status === "inactive") rt.count = f.el.initial;
      }
      S.save();
      MT.app.render();
      return true;
    }

    function wire(root) {
      root.addEventListener("input", (e) => {
        const t = e.target;
        if (t.dataset.text !== undefined) {
          d[t.dataset.text] = t.value;
          if (t.dataset.text === "name") t.style.color = d.color;
        } else if (t.dataset.num !== undefined) d[t.dataset.num] = t.value === "" ? "" : Number(t.value);
        else if (t.dataset.ivName !== undefined) d.intervals[+t.dataset.ivName].name = t.value;
      });
      root.addEventListener("change", (e) => {
        const t = e.target;
        if (t.dataset.bool) d[t.dataset.bool] = t.checked;
        if (t.tagName === "SELECT" && t.dataset.text) d[t.dataset.text] = t.value;
      });
      root.addEventListener("click", async (e) => {
        const sw = e.target.closest("[data-color]");
        if (sw) { d.color = sw.dataset.color; redraw(); return; }
        const b = e.target.closest("[data-ed]");
        if (!b) return;
        const i = +b.dataset.i;
        const act = b.dataset.ed;
        let v;
        switch (act) {
          case "color":
            v = await UI.colorPicker(d.color);
            if (v) { d.color = v; redraw(); }
            break;
          case "icon":
            v = await UI.iconPicker(d.icon);
            if (v !== null) { d.icon = v; redraw(); }
            break;
          case "duration":
            v = await UI.keypad("Time", { initial: d.duration });
            if (v) { d.duration = Math.abs(v); redraw(); }
            break;
          case "units":
            v = await UI.choose("Units of time", UNITS, d.units);
            if (v) { d.units = v; redraw(); }
            break;
          case "extra":
            v = await UI.choose("Extra info", EXTRA, d.extraInfo);
            if (v) { d.extraInfo = v; redraw(); }
            break;
          case "alert": await editAlert(d); redraw(); break;
          case "addtime": await editAddTime(d); redraw(); break;
          case "iv-color":
            v = await UI.colorPicker(d.intervals[i].color || d.color);
            if (v) { d.intervals[i].color = v; redraw(); }
            break;
          case "iv-dur":
            v = await UI.keypad(d.intervals[i].name || "Interval", { initial: d.intervals[i].duration });
            if (v) { d.intervals[i].duration = Math.abs(v); redraw(); }
            break;
          case "iv-up": [d.intervals[i - 1], d.intervals[i]] = [d.intervals[i], d.intervals[i - 1]]; redraw(); break;
          case "iv-del": d.intervals.splice(i, 1); redraw(); break;
          case "iv-add":
            d.intervals.push({ name: `Interval ${d.intervals.length + 1}`, duration: 5 * U.MIN, color: U.paletteColor(d.intervals.length + 3) });
            redraw();
            break;
          case "p-work": case "p-shortBreak": case "p-longBreak": {
            const k = act.slice(2);
            v = await UI.keypad(b.querySelector(".mt-row-title").textContent, { initial: d[k], allowZero: k !== "work" });
            if (v !== null) { d[k] = Math.abs(v); redraw(); }
            break;
          }
          case "ms-add":
            v = await UI.keypad("Notify after", { initial: 30 * U.MIN });
            if (v) { d.milestones = [...(d.milestones || []), Math.abs(v)].sort((a, b) => a - b); redraw(); }
            break;
          case "ms-del": d.milestones.splice(i, 1); redraw(); break;
          case "dial":
            v = await UI.choose("Dial style", [{ value: "digital", label: "Digital" }, { value: "analog", label: "Analog" }], d.dial);
            if (v) { d.dial = v; redraw(); }
            break;
          case "bt-add":
            if (d.buttons.length < 3) { d.buttons.push(S.createButton(d.buttons.length)); redraw(); }
            break;
          case "bt-up": [d.buttons[i - 1], d.buttons[i]] = [d.buttons[i], d.buttons[i - 1]]; redraw(); break;
          case "bt-del": d.buttons.splice(i, 1); redraw(); break;
          case "bt-edit": await ED.editButton(d.buttons[i], i, el.id); redraw(); break;
          case "ref": {
            const opts = ED.timerOptions(d.id);
            if (!opts.length) { UI.toast("Create a timer first", "error"); break; }
            v = await UI.choose("Timer", opts, d.ref);
            if (v) { d.ref = v; redraw(); }
            break;
          }
          case "history":
            sheet.close();
            MT.history.openFor(el.id);
            break;
          case "delete":
            if (await UI.confirm(`Delete “${U.esc(S.elementLabel(el))}”? You can restore it from Settings → Deleted data.`, { okLabel: "Delete", danger: true })) {
              sheet.close();
              S.deleteElement(el.id);
              MT.app.render();
            }
            break;
        }
      });
    }
  };

  async function editAlert(d) {
    d.alert = d.alert || { sound: "", vibrate: false, repeat: 1 };
    const a = d.alert;
    const sounds = MT.sounds.list();
    await new Promise((res) => {
      let preview = null;
      const o = UI.dialog({
        title: "Alert",
        body: `
          <label class="mt-row"><span class="flex-1 mt-row-title">Sound</span>
            <select class="mt-input w-40" id="al-sound"><option value="">Default (${U.esc(MT.sounds.name(S.state.settings.defaultSound))})</option>${sounds.map((s) => `<option value="${s.id}" ${s.id === a.sound ? "selected" : ""}>${U.esc(s.name)}</option>`).join("")}</select>
            <button type="button" class="mt-icon-btn-sm ml-1" id="al-play" aria-label="Preview"><i class="fa-solid fa-play"></i></button></label>
          <label class="mt-row cursor-pointer"><span class="flex-1 mt-row-title">Vibration<span class="mt-sub block">Android browsers only</span></span>${UI.switch("al-vib", a.vibrate)}</label>
          <label class="mt-row"><span class="flex-1 mt-row-title">Repeat</span>
            <select class="mt-input w-40" id="al-rep">${[1, 2, 3, 5, 10, 0].map((n) => `<option value="${n}" ${n === (a.repeat ?? 1) ? "selected" : ""}>${n === 0 ? "Until stopped" : n === 1 ? "Once" : n + " times"}</option>`).join("")}</select></label>`,
        buttons: [{ label: "Done", kind: "primary" }],
        onClose: () => { preview && preview.stop(); res(); },
        onMount: (el) => {
          el.querySelector("#al-sound").addEventListener("change", (e) => (a.sound = e.target.value));
          el.querySelector("#al-vib").addEventListener("change", (e) => (a.vibrate = e.target.checked));
          el.querySelector("#al-rep").addEventListener("change", (e) => (a.repeat = +e.target.value));
          el.querySelector("#al-play").addEventListener("click", () => {
            preview && preview.stop();
            preview = MT.sounds.play(a.sound || S.state.settings.defaultSound, { repeat: 1 });
          });
        },
      });
    });
  }

  async function editAddTime(d) {
    await new Promise((res) => {
      const draw = (el) => {
        el.querySelector("#at-list").innerHTML = (d.addTimeButtons || []).map((v, i) =>
          `<span class="mt-chip">${v > 0 ? "+" : ""}${U.fmtHuman(v)} <button type="button" data-del="${i}" class="ml-1 text-red-500" aria-label="Remove">×</button></span>`).join("") || '<span class="mt-sub">No buttons</span>';
      };
      UI.dialog({
        title: "Add time buttons",
        body: `<p class="mt-sub mb-3">Shown in the single view and the long-press menu. Negative values subtract time.</p>
          <div id="at-list" class="flex flex-wrap gap-2 mb-3"></div>
          <div class="flex gap-2"><button type="button" class="mt-btn mt-btn-soft flex-1" id="at-add"><i class="fa-solid fa-plus mr-1"></i>Add time</button>
          <button type="button" class="mt-btn mt-btn-ghost" id="at-def">Default</button></div>`,
        buttons: [{ label: "Done", kind: "primary" }],
        onClose: res,
        onMount: (el) => {
          draw(el);
          el.querySelector("#at-list").addEventListener("click", (e) => {
            const b = e.target.closest("[data-del]");
            if (b) { d.addTimeButtons.splice(+b.dataset.del, 1); draw(el); }
          });
          el.querySelector("#at-add").addEventListener("click", async () => {
            const v = await UI.keypad("Add time", { allowNegative: true });
            if (v && d.addTimeButtons.length < 6) { d.addTimeButtons.push(v); draw(el); }
          });
          el.querySelector("#at-def").addEventListener("click", () => { d.addTimeButtons = [U.MIN, 5 * U.MIN]; draw(el); });
        },
      });
    });
  }

  /** Button editor: color, label, commands {timer, status, action, value}. Edits `btn` in place on Done. */
  ED.editButton = (btn, index, ownerId) =>
    new Promise((res) => {
      const b = U.clone(btn);
      const timers = ED.timerOptions(ownerId);
      const body = () => `
        <div class="max-w-xl mx-auto w-full">
          <div class="mt-swatches mb-3">${U.PALETTE.map((p) => `<button type="button" class="mt-swatch ${b.color === p.hex ? "active" : ""}" data-color="${p.hex}" style="--c:${p.hex}"></button>`).join("")}
            <button type="button" class="mt-swatch custom" data-act="color" style="--c:${b.color}"><i class="fa-solid fa-eye-dropper"></i></button></div>
          <input class="mt-name-input mb-4" id="bt-label" style="color:${b.color}" value="${U.esc(b.label)}" placeholder="Add label" maxlength="30"/>
          <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1"><span>Timer</span><span>Status</span><span>Action</span><span></span></div>
          ${b.commands.map((c, i) => `
            <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2 items-center">
              <select class="mt-input text-xs" data-cmd="${i}" data-k="timer"><option value="any">Any (this board)</option>${timers.map((t) => `<option value="${t.value}" ${t.value === c.timer ? "selected" : ""}>${U.esc(t.label)} — ${U.esc(t.board)}</option>`).join("")}</select>
              <select class="mt-input text-xs" data-cmd="${i}" data-k="status">${STATUSES.map((s) => `<option value="${s.value}" ${s.value === c.status ? "selected" : ""}>${s.label}</option>`).join("")}</select>
              <button type="button" class="mt-input text-xs text-left truncate" data-act="action" data-i="${i}">${actionLabel(c)}</button>
              <button type="button" class="mt-icon-btn-sm text-red-500" data-act="del" data-i="${i}" aria-label="Remove command"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join("")}
          <button type="button" class="mt-btn mt-btn-soft w-full mt-2" data-act="add"><i class="fa-solid fa-plus mr-1"></i>Add command</button>
          <p class="mt-sub mt-3">Commands run top to bottom. “Status” limits a command to timers that were in that state when you pressed the button — e.g. Timer: REST · Status: Waiting · Action: Add 9h. Pair “Inactive → Start” with “Running → Pause” to make a start/pause toggle.</p>
        </div>`;
      const sheet = UI.sheet({
        title: `Button ${index + 1}`,
        body: body(),
        onDone: () => { Object.assign(btn, b); res(); },
        onCancel: () => res(),
      });
      const root = sheet.el.querySelector(".mt-sheet-body");
      const redraw = () => (root.innerHTML = body());
      root.addEventListener("input", (e) => {
        if (e.target.id === "bt-label") { b.label = e.target.value; e.target.style.color = b.color; }
      });
      root.addEventListener("change", (e) => {
        const t = e.target;
        if (t.dataset.cmd !== undefined) b.commands[+t.dataset.cmd][t.dataset.k] = t.value;
      });
      root.addEventListener("click", async (e) => {
        const sw = e.target.closest("[data-color]");
        if (sw) { b.color = sw.dataset.color; redraw(); return; }
        const a = e.target.closest("[data-act]");
        if (!a) return;
        const i = +a.dataset.i;
        if (a.dataset.act === "color") {
          const v = await UI.colorPicker(b.color);
          if (v) { b.color = v; redraw(); }
        } else if (a.dataset.act === "add") {
          b.commands.push({ timer: "any", status: "any", action: "start", value: 0 });
          redraw();
        } else if (a.dataset.act === "del") {
          b.commands.splice(i, 1);
          redraw();
        } else if (a.dataset.act === "action") {
          const v = await UI.choose("Action", ACTIONS, b.commands[i].action);
          if (!v) return;
          const c = b.commands[i];
          c.action = v;
          if (v === "delay" || v === "addTime") {
            const ms = await UI.keypad(v === "delay" ? "Delay" : "Add time", { initial: c.value || 0, allowNegative: v === "addTime" });
            c.value = ms || c.value || U.MIN;
          }
          redraw();
        }
      });
    });

  function actionLabel(c) {
    const a = ACTIONS.find((x) => x.value === c.action)?.label || "Select";
    if (c.action === "addTime") return `Add ${U.fmtHuman(c.value || 0)}`;
    if (c.action === "delay") return `Delay ${U.fmtHuman(c.value || 0)}`;
    return a;
  }
  ED.actionLabel = actionLabel;
})(window.MT);
