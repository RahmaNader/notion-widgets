/* Multi Timer — timing engine (wall-clock based; survives tab switches and reloads) */
window.MT = window.MT || {};
(function (MT) {
  const S = MT.store;
  const E = (MT.engine = {});
  const SEGMENTED = ["countdown", "quick", "interval", "pomodoro"];

  E.isSegmented = (el) => SEGMENTED.includes(el.type);
  E.hasRuntime = (el) => SEGMENTED.includes(el.type) || ["countup", "stopwatch", "counter"].includes(el.type);
  E.onAlarm = () => {}; // set by app
  E.onChange = () => {}; // set by app

  /** Resolve containers to their referenced timer. */
  E.target = (el) => {
    if (el && el.type === "container") {
      const f = el.ref && S.find(el.ref);
      return f && f.el.type !== "container" ? f.el : null;
    }
    return el;
  };

  /* ---------- segments ---------- */
  E.segments = (el) => {
    switch (el.type) {
      case "interval":
        return (el.intervals || []).filter((i) => i.duration > 0).map((i) => ({ name: i.name || "Interval", dur: i.duration, color: i.color || el.color }));
      case "pomodoro": {
        const out = [];
        const n = Math.max(1, el.sessions || 1);
        for (let i = 0; i < n; i++) {
          out.push({ name: "Work", dur: el.work, color: el.color });
          if (i < n - 1) out.push({ name: "Short break", dur: el.shortBreak, color: MT.util.PALETTE[3].hex });
          else if (el.longBreak > 0) out.push({ name: "Long break", dur: el.longBreak, color: MT.util.PALETTE[5].hex });
        }
        return out.filter((s) => s.dur > 0);
      }
      default:
        return [{ name: S.elementLabel(el), dur: el.duration || 0, color: el.color }];
    }
  };
  E.seg = (el, i) => E.segments(el)[i || 0] || { name: "", dur: 0, color: el.color };
  E.cycles = (el) => (el.type === "interval" ? Math.max(1, el.repeats || 1) : 1);

  /* ---------- reads ---------- */
  E.elapsed = (el, now) => {
    const rt = el.rt || {};
    return (rt.acc || 0) + (rt.status === "running" && rt.activeSince ? now - rt.activeSince : 0);
  };

  /** Remaining ms of current segment (negative = overtime). */
  E.remaining = (el, now) => {
    const rt = el.rt || {};
    switch (rt.status) {
      case "running": return rt.endsAt - now;
      case "waiting": return rt.delayUntil ? E.seg(el, 0).dur : rt.remaining;
      case "completed": return -(now - rt.finishedAt);
      default: return E.seg(el, 0).dur;
    }
  };

  E.progress = (el, now) => {
    const rt = el.rt || {};
    if (E.isSegmented(el)) {
      if (rt.status === "completed") return 0;
      if (rt.status === "inactive" || rt.delayUntil) return 1;
      const total = rt.segTotal || E.seg(el, rt.segIndex).dur || 1;
      return MT.util.clamp(E.remaining(el, now) / total, 0, 1);
    }
    if (el.type === "countup") return ((E.elapsed(el, now) % 3600000) / 3600000) || (rt.status === "inactive" ? 1 : 0);
    if (el.type === "stopwatch") return rt.status === "inactive" ? 1 : (E.elapsed(el, now) % 60000) / 60000;
    if (el.type === "counter") {
      const span = (el.final ?? 0) - (el.initial ?? 0);
      if (!span) return 1;
      const c = rt.count ?? el.initial;
      return MT.util.clamp((c - el.initial) / span, 0, 1);
    }
    return 1;
  };

  /* ---------- actions ---------- */
  function beginSeg(el, startAt) {
    const rt = el.rt;
    const s = E.seg(el, rt.segIndex);
    rt.segTotal = s.dur;
    rt.segStartedAt = startAt;
    rt.endsAt = startAt + s.dur;
    rt.acc = 0;
    rt.activeSince = startAt;
    rt.remaining = null;
    rt.status = "running";
  }

  E.start = (el, now, opts = {}) => {
    if (el.type === "quick") {
      if (opts.duration) el.duration = opts.duration;
      if (!el.duration) return false;
    }
    if (E.isSegmented(el)) {
      if (!E.segments(el).length) return false;
      const keepName = el.rt?.quickName;
      el.rt = { status: "running", segIndex: 0, cycle: 0, runStart: now };
      if (opts.quickName !== undefined) el.rt.quickName = opts.quickName;
      else if (keepName) el.rt.quickName = keepName;
      beginSeg(el, now);
    } else if (el.type === "countup") {
      const from = el.startFrom ? Date.parse(el.startFrom) : NaN;
      el.rt = { status: "running", acc: isNaN(from) ? 0 : Math.max(0, now - from), activeSince: now, runStart: isNaN(from) ? now : from, fired: [] };
    } else if (el.type === "stopwatch") {
      el.rt = { status: "running", acc: 0, activeSince: now, runStart: now, laps: [] };
    } else return false;
    E.changed(el);
    return true;
  };

  E.pause = (el, now) => {
    const rt = el.rt;
    if (rt.status !== "running") return;
    rt.acc = (rt.acc || 0) + (now - rt.activeSince);
    rt.activeSince = null;
    if (E.isSegmented(el)) rt.remaining = rt.endsAt - now;
    rt.status = "waiting";
    E.changed(el);
  };

  E.resume = (el, now) => {
    const rt = el.rt;
    if (rt.status !== "waiting") return;
    if (rt.delayUntil) { E.start(el, now); return; }
    rt.activeSince = now;
    if (E.isSegmented(el)) {
      if (!rt.segStartedAt) rt.segStartedAt = now;
      rt.endsAt = now + rt.remaining;
      rt.remaining = null;
    }
    rt.status = "running";
    E.changed(el);
  };

  E.reset = (el, now, { log = true } = {}) => {
    const rt = el.rt || {};
    if (log && (rt.status === "running" || rt.status === "waiting") && !rt.delayUntil) {
      const dur = E.elapsed(el, now);
      if (E.isSegmented(el))
        S.logHistory(el, { start: rt.segStartedAt || rt.runStart, end: now, dur, label: E.seg(el, rt.segIndex).name, partial: true, kind: "stop" });
      else if (el.type === "countup" || el.type === "stopwatch")
        S.logHistory(el, { start: rt.runStart, end: now, dur, kind: "stop" });
    }
    if (log && el.type === "counter" && rt.count != null && rt.count !== el.initial && rt.runStart)
      S.logHistory(el, { start: rt.runStart, end: now, dur: now - rt.runStart, label: `Count ${rt.count}`, partial: rt.status !== "completed", kind: "stop" });
    el.rt = { status: "inactive" };
    E.stopRinging(el.id);
    E.changed(el);
  };

  E.addTime = (el, ms, now) => {
    const rt = el.rt;
    if (E.isSegmented(el)) {
      if (rt.status === "inactive" || rt.delayUntil) {
        if (!E.start(el, now)) return;
        el.rt.endsAt += ms;
        el.rt.segTotal += ms;
      } else if (rt.status === "running") {
        rt.endsAt += ms;
        rt.segTotal = Math.max(1, rt.segTotal + ms);
      } else if (rt.status === "waiting") {
        rt.remaining = Math.max(0, rt.remaining + ms);
        rt.segTotal = Math.max(1, rt.segTotal + ms);
      } else if (rt.status === "completed") {
        if (ms <= 0) return;
        rt.status = "running";
        rt.activeSince = now;
        rt.endsAt = now + ms;
        rt.segTotal = ms;
        rt.finishedAt = null;
        E.stopRinging(el.id);
      }
    } else if (el.type === "countup" || el.type === "stopwatch") {
      if (rt.status === "inactive") E.start(el, now);
      el.rt.acc = Math.max(0, (el.rt.acc || 0) + ms);
    } else return;
    E.changed(el);
  };

  E.delay = (el, ms, now) => {
    if (!E.isSegmented(el) || ms <= 0) return;
    E.reset(el, now);
    el.rt = { status: "waiting", delayUntil: now + ms, delayTotal: ms };
    E.changed(el);
  };

  E.lap = (el, now) => {
    if (el.type !== "stopwatch" || el.rt.status === "inactive") return;
    el.rt.laps = el.rt.laps || [];
    el.rt.laps.push(E.elapsed(el, now));
    E.changed(el);
  };

  E.counterStep = (el, dir, now) => {
    if (el.type !== "counter") return;
    const rt = el.rt;
    const step = Math.abs(Number(el.step) || 1);
    const initial = Number(el.initial) || 0;
    const final = el.final === "" || el.final == null ? null : Number(el.final);
    if (rt.status === "completed" && dir > 0) return;
    const cur = rt.count ?? initial;
    const next = cur + dir * step;
    if (!rt.runStart) rt.runStart = now;
    rt.count = next;
    const up = final == null || final >= initial;
    const done = final != null && final !== initial && (up ? next >= final : next <= final);
    if (done) {
      rt.count = final;
      rt.status = "completed";
      rt.finishedAt = now;
      S.logHistory(el, { start: rt.runStart, end: now, dur: now - rt.runStart, label: `Reached ${final}`, kind: "finish" });
      E.onAlarm(el, { at: now });
    } else {
      rt.status = next === initial ? "inactive" : "running";
      if (rt.status === "inactive") rt.runStart = null;
    }
    E.changed(el);
  };

  /** Primary tap action. Returns false when UI input is required (quick timer). */
  E.toggle = (el, now) => {
    const rt = el.rt;
    if (el.type === "counter") { E.counterStep(el, 1, now); return true; }
    switch (rt.status) {
      case "running": E.pause(el, now); return true;
      case "waiting": E.resume(el, now); return true;
      case "completed": E.reset(el, now); return true;
      default: return E.start(el, now);
    }
  };

  /* ---------- tick ---------- */
  function completeSeg(el, now) {
    const rt = el.rt;
    const end = rt.endsAt;
    const elapsed = (rt.acc || 0) + (end - (rt.activeSince ?? end));
    const s = E.seg(el, rt.segIndex);
    S.logHistory(el, { start: rt.segStartedAt, end, dur: elapsed, label: s.name, kind: "finish" });
    const silent = now - end > 10000;
    const n = E.segments(el).length;
    let ni = rt.segIndex + 1, nc = rt.cycle || 0;
    if (ni >= n) { ni = 0; nc++; }
    const allDone = ni === 0 && nc >= E.cycles(el);
    if (!allDone) {
      rt.segIndex = ni;
      rt.cycle = nc;
      const next = E.seg(el, ni);
      E.onAlarm(el, { silent, short: true, label: next.name, at: end });
      if (el.pauseBetween) {
        rt.status = "waiting";
        rt.remaining = next.dur;
        rt.segTotal = next.dur;
        rt.acc = 0;
        rt.activeSince = null;
        rt.segStartedAt = null;
      } else beginSeg(el, end);
      return;
    }
    E.onAlarm(el, { silent, at: end });
    if (el.autoRepeat) {
      rt.segIndex = 0;
      rt.cycle = 0;
      rt.repeats = (rt.repeats || 0) + 1;
      beginSeg(el, end);
      return;
    }
    if (el.autoComplete) {
      el.rt = { status: "inactive" };
      return;
    }
    rt.status = "completed";
    rt.finishedAt = end;
    rt.acc = elapsed;
    rt.activeSince = null;
  }

  /** Advances one element to `now`. Returns true if its status/segment changed. */
  E.update = (el, now) => {
    const rt = el.rt;
    if (!rt) return false;
    let changed = false;
    if (rt.status === "waiting" && rt.delayUntil && now >= rt.delayUntil) {
      const at = rt.delayUntil;
      E.start(el, at);
      changed = true;
    }
    if (E.isSegmented(el) && rt.status === "running") {
      let guard = 0;
      while (el.rt.status === "running" && now >= el.rt.endsAt && guard++ < 1000) {
        completeSeg(el, now);
        changed = true;
      }
    }
    if (el.type === "countup" && rt.status === "running" && el.milestones && el.milestones.length) {
      const elapsed = E.elapsed(el, now);
      rt.fired = rt.fired || [];
      el.milestones.forEach((m) => {
        if (m > 0 && elapsed >= m && !rt.fired.includes(m)) {
          rt.fired.push(m);
          E.onAlarm(el, { short: true, label: "Milestone " + MT.util.fmtHuman(m), silent: elapsed - m > 10000, at: E.milestoneAt(el, m) });
          changed = true;
        }
      });
    }
    if (changed) E.changed(el, true);
    return changed;
  };

  /** Wall-clock time a count-up milestone is reached (stable while running). */
  E.milestoneAt = (el, m) => (el.rt.activeSince || Date.now()) + m - (el.rt.acc || 0);

  /** Upcoming alarms of running timers, for the notifier window. */
  E.upcoming = (now) => {
    const out = [];
    S.allElements().forEach(({ el, board }) => {
      const rt = el.rt;
      if (!rt || rt.status !== "running") return;
      if (E.isSegmented(el)) {
        const n = E.segments(el).length;
        let ni = rt.segIndex + 1, nc = rt.cycle || 0;
        if (ni >= n) { ni = 0; nc++; }
        const final = ni === 0 && nc >= E.cycles(el);
        out.push({ id: el.id, at: rt.endsAt, final, label: final ? "" : E.seg(el, ni).name, board: board.name });
      } else if (el.type === "countup" && el.milestones && el.milestones.length) {
        const m = el.milestones.find((x) => x > 0 && !(rt.fired || []).includes(x));
        if (m) out.push({ id: el.id, at: E.milestoneAt(el, m), final: false, label: "Milestone " + MT.util.fmtHuman(m), board: board.name });
      }
    });
    return out.filter((x) => x.at > now - 1000);
  };

  E.tickAll = (now) => {
    let changed = false;
    S.state.boards.forEach((b) => b.elements.forEach((el) => { if (E.update(el, now)) changed = true; }));
    return changed;
  };

  E.changed = (el, fromTick) => {
    S.save();
    E.onChange(el, fromTick);
  };

  /* ---------- status helpers ---------- */
  E.status = (el) => {
    const t = E.target(el);
    return t && t.rt ? t.rt.status : "inactive";
  };
  E.statusMatches = (el, filter) => !filter || filter === "any" || E.status(el) === filter;

  /* ---------- ringing registry (filled by app alarm handler) ---------- */
  E.ringing = new Map();
  E.stopRinging = (id, { keepNotification = false } = {}) => {
    if (!keepNotification && MT.notify) MT.notify.clear(id);
    const r = E.ringing.get(id);
    if (r) {
      try { r.sound && r.sound.stop(); } catch (e) {}
      E.ringing.delete(id);
      MT.app && MT.app.refreshAlertOverlay && MT.app.refreshAlertOverlay();
    }
  };

  /* ---------- Buttons element ---------- */
  /** Snapshot of every timer's status, so all commands of one button press see the same state. */
  E.statusSnapshot = () => {
    const m = new Map();
    S.allElements().forEach(({ el }) => m.set(el.id, E.status(el)));
    return m;
  };

  E.runCommand = (cmd, boardId, now, snap = E.statusSnapshot()) => {
    let targets;
    if (!cmd.timer || cmd.timer === "any") {
      const b = S.board(boardId);
      targets = b ? b.elements.filter((e) => E.hasRuntime(e) || e.type === "container") : [];
    } else {
      const f = S.find(cmd.timer);
      targets = f ? [f.el] : [];
    }
    targets = targets.map(E.target).filter(Boolean);
    let count = 0;
    targets.forEach((t) => {
      const st = snap.has(t.id) ? snap.get(t.id) : t.rt.status;
      if (cmd.status && cmd.status !== "any" && st !== cmd.status) return;
      switch (cmd.action) {
        case "start":
          if (st === "inactive" || st === "completed") { if (E.start(t, now)) count++; }
          break;
        case "delay":
          if (cmd.value > 0) { E.delay(t, cmd.value, now); count++; }
          break;
        case "pause":
          if (st === "running") { E.pause(t, now); count++; }
          break;
        case "continue":
          if (st === "waiting") { E.resume(t, now); count++; }
          break;
        case "addTime":
          if (cmd.value) { E.addTime(t, cmd.value, now); count++; }
          break;
        case "reset":
          if (st !== "inactive" || t.type === "counter") { E.reset(t, now); count++; }
          break;
      }
    });
    return count;
  };
})(window.MT);
