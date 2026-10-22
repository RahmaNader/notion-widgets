/* Multi Timer — state, persistence, undo, trash, history log */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util;
  const KEY = "multiTimer.v1";
  const MIN = U.MIN;

  const DEFAULT_SETTINGS = {
    display: "system", // system | always | running
    doubleTapReset: true,
    quickNamePrompt: false,
    volume: 0.8,
    statusNotifications: false,
    fullScreenAlert: true,
    waitingAnimation: true,
    keepHistory: "forever", // forever | 1y | 6m | 3m | 1m | 1w
    defaultSound: "alarm",
  };

  const TYPE_INFO = {
    countdown: { label: "Countdown timer", icon: "hourglass-half", desc: "A timer that counts down a predetermined time interval. Supports looping (auto-repeat) and delayed start." },
    quick: { label: "Quick timer", icon: "bolt", desc: "A countdown timer without a predetermined duration. Set the time when the timer starts." },
    interval: { label: "Interval timer", icon: "repeat", desc: "Countdown timer with the ability to add the desired number of time intervals and their repetitions. Supports a pause between intervals." },
    pomodoro: { label: "Pomodoro timer", icon: "stopwatch", desc: "Interval countdown timer with functions of the Pomodoro technique." },
    countup: { label: "CountUp timer", icon: "arrow-up-right-dots", desc: "A timer that counts upward. Track time from a chosen point and add notifications to stay on schedule." },
    stopwatch: { label: "Stopwatch", icon: "stopwatch-20", desc: "A count-up timer that measures time intervals with an accuracy of fractions of a second. Records laps and splits." },
    counter: { label: "Counter", icon: "plus-minus", desc: "A preset step counter used to count in an increasing or decreasing manner. Set both an initial value and a final one." },
    clock: { label: "Clock", icon: "clock", desc: "A clock that lets you choose the time zone, time format, and dial style." },
    buttons: { label: "Buttons", icon: "toggle-on", desc: "An element on which you can place several buttons and assign actions to them to control other elements on the board." },
    container: { label: "Container", icon: "box-open", desc: "A visual tool that lets you run any timer created on this or another board directly in the container itself." },
  };

  const S = (MT.store = { state: null, undoStack: [], TYPE_INFO, DEFAULT_SETTINGS, KEY });

  S.defaults = (type) => {
    const base = {
      name: "",
      color: U.PALETTE[3].hex,
      icon: "",
      note: "",
      alert: { sound: "", vibrate: false, repeat: 1 },
      extraInfo: "overtime",
      addTimeButtons: [MIN, 5 * MIN],
      autoRepeat: false,
      autoComplete: false,
      units: "auto",
    };
    switch (type) {
      case "countdown": return { ...base, duration: 10 * MIN };
      case "quick": return { ...base, duration: 0, name: "" };
      case "interval":
        return {
          ...base, repeats: 3, pauseBetween: false,
          intervals: [
            { name: "Work", duration: 20 * MIN, color: U.PALETTE[3].hex },
            { name: "Rest", duration: 5 * MIN, color: U.PALETTE[4].hex },
          ],
        };
      case "pomodoro":
        return { ...base, name: "Pomodoro", color: U.PALETTE[0].hex, icon: "stopwatch", work: 25 * MIN, shortBreak: 5 * MIN, longBreak: 15 * MIN, sessions: 4, pauseBetween: false };
      case "countup": return { ...base, extraInfo: "start", startFrom: "", milestones: [] };
      case "stopwatch": return { ...base, extraInfo: "none", color: U.PALETTE[7].hex };
      case "counter": return { ...base, extraInfo: "none", initial: 0, final: 10, step: 1, color: U.PALETTE[4].hex };
      case "clock": return { ...base, extraInfo: "none", tz: "", hour12: false, dial: "digital", seconds: true, color: U.PALETTE[0].hex };
      case "buttons": return { ...base, extraInfo: "none", buttons: [S.createButton(0)] };
      case "container": return { ...base, extraInfo: "none", ref: "" };
      default: return base;
    }
  };

  S.createButton = (i = 0) => ({
    id: U.uid(),
    label: "",
    color: U.paletteColor(7 - (i % 8)),
    commands: [{ timer: "any", status: "any", action: "start", value: 0 }],
  });

  S.createElement = (type, over = {}) => {
    const el = { id: U.uid(), type, ...S.defaults(type), ...U.clone(over), rt: { status: "inactive" } };
    if (!el.name && type !== "quick") el.name = TYPE_INFO[type]?.label || "Timer";
    return el;
  };

  S.createBoard = (name) => ({ id: U.uid(), name: name || "Board", columns: 0, elements: [] });

  /* ---------- load / save ---------- */
  S.load = () => {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) { st = null; }
    if (!st || !Array.isArray(st.boards)) {
      const b = S.createBoard("Timers");
      st = { version: 1, boards: [b], activeBoardId: b.id };
    }
    st.settings = { ...DEFAULT_SETTINGS, ...(st.settings || {}) };
    st.history = Array.isArray(st.history) ? st.history : [];
    st.trash = Array.isArray(st.trash) ? st.trash : [];
    st.customColors = Array.isArray(st.customColors) ? st.customColors : [];
    st.customSounds = Array.isArray(st.customSounds) ? st.customSounds : [];
    st.sources = Array.isArray(st.sources) ? st.sources : [];
    if (!st.boards.length) st.boards.push(S.createBoard("Timers"));
    st.boards.forEach((b) => {
      b.elements = Array.isArray(b.elements) ? b.elements : [];
      b.elements.forEach((el) => {
        const d = S.defaults(el.type);
        for (const k in d) if (el[k] === undefined) el[k] = U.clone(d[k]);
        if (!el.rt) el.rt = { status: "inactive" };
      });
    });
    if (!st.boards.find((b) => b.id === st.activeBoardId)) st.activeBoardId = st.boards[0].id;
    S.state = st;
    S.pruneHistory();
    return st;
  };

  S.saveNow = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S.state));
    } catch (e) {
      console.error("Multi Timer: save failed", e);
      MT.ui && MT.ui.toast("Could not save — browser storage is full or blocked", "error");
    }
  };
  S.save = U.debounce(S.saveNow, 250);

  /* ---------- lookups ---------- */
  S.board = (id) => S.state.boards.find((b) => b.id === id);
  S.activeBoard = () => S.board(S.state.activeBoardId) || S.state.boards[0];
  S.allElements = () => {
    const out = [];
    S.state.boards.forEach((b) => b.elements.forEach((el) => out.push({ el, board: b })));
    return out;
  };
  S.find = (id) => {
    for (const b of S.state.boards) {
      const i = b.elements.findIndex((e) => e.id === id);
      if (i >= 0) return { el: b.elements[i], board: b, index: i };
    }
    return null;
  };
  S.timerElements = () =>
    S.allElements().filter(({ el }) => !["clock", "buttons", "container"].includes(el.type));

  /* ---------- undo ---------- */
  S.checkpoint = () => {
    S.undoStack.push(JSON.stringify({ boards: S.state.boards, activeBoardId: S.state.activeBoardId, trash: S.state.trash }));
    if (S.undoStack.length > 30) S.undoStack.shift();
  };
  S.canUndo = () => S.undoStack.length > 0;
  S.undo = () => {
    const snap = S.undoStack.pop();
    if (!snap) return false;
    const prev = JSON.parse(snap);
    // keep live runtime of timers that still exist so undo doesn't rewind running clocks
    const live = new Map();
    S.allElements().forEach(({ el }) => live.set(el.id, el.rt));
    prev.boards.forEach((b) => b.elements.forEach((el) => { if (live.has(el.id)) el.rt = live.get(el.id); }));
    S.state.boards = prev.boards;
    S.state.activeBoardId = prev.activeBoardId;
    S.state.trash = prev.trash;
    S.save();
    return true;
  };

  /* ---------- boards & elements ---------- */
  S.addBoard = (name) => {
    const b = S.createBoard(S.uniqueBoardName(name || "New board"));
    S.state.boards.push(b);
    S.save();
    return b;
  };
  S.uniqueBoardName = (name) => {
    let n = name, i = 2;
    const names = new Set(S.state.boards.map((b) => b.name.toLowerCase()));
    while (names.has(n.toLowerCase())) n = `${name} (${i++})`;
    return n;
  };

  S.freshCopy = (el) => {
    const c = U.clone(el);
    c.id = U.uid();
    c.rt = { status: "inactive" };
    if (c.buttons) c.buttons.forEach((b) => (b.id = U.uid()));
    return c;
  };

  S.copyElement = (id) => {
    const f = S.find(id);
    if (!f) return null;
    S.checkpoint();
    const c = S.freshCopy(f.el);
    f.board.elements.splice(f.index + 1, 0, c);
    S.save();
    return c;
  };

  S.moveElement = (id, boardId) => {
    const f = S.find(id);
    const to = S.board(boardId);
    if (!f || !to || f.board.id === boardId) return;
    S.checkpoint();
    f.board.elements.splice(f.index, 1);
    to.elements.push(f.el);
    S.save();
  };

  S.deleteElement = (id) => {
    const f = S.find(id);
    if (!f) return;
    S.checkpoint();
    f.board.elements.splice(f.index, 1);
    f.el.rt = { status: "inactive" };
    S.state.trash.unshift({ kind: "element", data: f.el, boardId: f.board.id, boardName: f.board.name, deletedAt: Date.now() });
    S.save();
  };

  S.copyBoard = (id) => {
    const b = S.board(id);
    if (!b) return null;
    S.checkpoint();
    const idMap = {};
    const nb = { ...U.clone(b), id: U.uid(), name: S.uniqueBoardName(b.name + " copy") };
    nb.elements = b.elements.map((el) => {
      const c = S.freshCopy(el);
      idMap[el.id] = c.id;
      return c;
    });
    // re-point buttons/containers that referenced timers inside the copied board
    nb.elements.forEach((el) => {
      if (el.type === "container" && idMap[el.ref]) el.ref = idMap[el.ref];
      if (el.type === "buttons")
        el.buttons.forEach((bt) => bt.commands.forEach((c) => { if (idMap[c.timer]) c.timer = idMap[c.timer]; }));
    });
    const idx = S.state.boards.indexOf(b);
    S.state.boards.splice(idx + 1, 0, nb);
    S.save();
    return nb;
  };

  S.deleteBoard = (id) => {
    const idx = S.state.boards.findIndex((b) => b.id === id);
    if (idx < 0) return;
    S.checkpoint();
    const [b] = S.state.boards.splice(idx, 1);
    b.elements.forEach((el) => (el.rt = { status: "inactive" }));
    S.state.trash.unshift({ kind: "board", data: b, deletedAt: Date.now() });
    if (!S.state.boards.length) S.state.boards.push(S.createBoard("Timers"));
    if (S.state.activeBoardId === id) S.state.activeBoardId = S.state.boards[Math.max(0, idx - 1)].id;
    S.save();
  };

  S.restoreTrash = (i) => {
    const item = S.state.trash[i];
    if (!item) return;
    S.state.trash.splice(i, 1);
    if (item.kind === "board") {
      item.data.name = S.uniqueBoardName(item.data.name);
      S.state.boards.push(item.data);
    } else {
      const b = S.board(item.boardId) || S.activeBoard();
      b.elements.push(item.data);
    }
    S.save();
  };

  /* ---------- history ---------- */
  S.logHistory = (el, rec) => {
    if (!rec || rec.dur == null || rec.dur < 1000) return;
    const f = S.find(el.id);
    S.state.history.push({
      id: U.uid(),
      el: el.id,
      board: f ? f.board.id : "",
      boardName: f ? f.board.name : "",
      name: el.name || TYPE_INFO[el.type]?.label || "Timer",
      type: el.type,
      label: rec.label || "",
      start: rec.start,
      end: rec.end,
      dur: Math.round(rec.dur),
      partial: !!rec.partial,
      kind: rec.kind || "finish",
    });
    S.save();
  };

  const RETENTION = { "1w": 7, "1m": 31, "3m": 92, "6m": 183, "1y": 366 };
  S.pruneHistory = () => {
    const days = RETENTION[S.state.settings.keepHistory];
    if (!days) return;
    const cutoff = Date.now() - days * U.DAY;
    S.state.history = S.state.history.filter((r) => (r.end || r.start) >= cutoff);
  };

  S.elementLabel = (el) => el.name || (el.type === "quick" ? el.rt?.quickName || "Quick timer" : TYPE_INFO[el.type]?.label || "");
})(window.MT);
