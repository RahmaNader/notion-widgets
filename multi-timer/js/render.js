/* Multi Timer — element rendering (rings, counters, clocks, buttons, containers) */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util, S = MT.store, E = MT.engine;
  const R = (MT.render = {});
  const C = 2 * Math.PI * 45;

  /* ---------- view model ---------- */
  R.vm = (el, now) => {
    const t = E.target(el);
    if (!t) return { status: "inactive", time: "—", label: el.type === "container" ? "Empty container" : "", extra: "Tap to choose a timer", progress: 0, color: el.color, empty: true };
    const rt = t.rt || { status: "inactive" };
    const vm = { status: rt.status, color: t.color, progress: E.progress(t, now), label: S.elementLabel(t), extra: "", dashed: false, icon: t.icon };

    if (E.isSegmented(t)) {
      const seg = E.seg(t, rt.segIndex);
      const multi = E.segments(t).length > 1 || E.cycles(t) > 1;
      if (multi && rt.status !== "inactive" && seg.color) vm.color = seg.color;
      if (rt.delayUntil) {
        vm.time = U.ringTime(seg.dur, { units: t.units });
        vm.extra = `<i class="fa-solid fa-hourglass-start"></i> starts in ${U.plainTime(rt.delayUntil - now)}`;
        vm.dashed = true;
      } else {
        const rem = E.remaining(t, now);
        vm.time = t.type === "quick" && rt.status === "inactive" && !t.duration ? "00:00" : U.ringTime(Math.max(0, rem), { units: t.units });
        if (multi && rt.status !== "inactive") {
          const total = E.cycles(t) > 1 ? ` ${(rt.cycle || 0) + 1}/${E.cycles(t)}` : "";
          vm.extra = `${U.esc(seg.name)}${total}`;
        }
        const x = t.extraInfo;
        if (rt.status === "completed" && x === "overtime") vm.extra = `<span class="ot">+${U.plainTime(-rem)}</span>`;
        else if (rt.status !== "inactive" && rt.status !== "completed") {
          if (x === "elapsed") vm.extra = (vm.extra ? vm.extra + " · " : "") + U.plainTime(E.elapsed(t, now));
          else if (x === "start" && rt.segStartedAt) vm.extra = (vm.extra ? vm.extra + " · " : "") + `▷ ${U.fmtClock(rt.segStartedAt, false)}`;
          else if (x === "finish" && rt.status === "running") vm.extra = (vm.extra ? vm.extra + " · " : "") + `⚑ ${U.fmtClock(rt.endsAt, false)}`;
        } else if (rt.status === "completed" && x === "finish" && rt.finishedAt) vm.extra = `⚑ ${U.fmtClock(rt.finishedAt, false)}`;
      }
      if (t.type === "quick" && rt.quickName) vm.label = rt.quickName;
    } else if (t.type === "countup") {
      vm.time = U.ringTime(E.elapsed(t, now), { ceil: false, units: t.units });
      vm.dashed = true;
      if (t.extraInfo === "start" && rt.runStart) vm.extra = `▷ ${U.fmtClock(rt.runStart, false)}`;
      if (rt.fired && rt.fired.length && t.milestones.length) vm.extra += ` · ${rt.fired.length}/${t.milestones.length}`;
    } else if (t.type === "stopwatch") {
      vm.time = U.swTime(E.elapsed(t, now));
      vm.dashed = true;
      if (rt.laps && rt.laps.length) vm.extra = `Lap ${rt.laps.length + 1}`;
    } else if (t.type === "counter") {
      vm.time = String(rt.count ?? t.initial ?? 0);
      vm.counter = true;
      if (t.final !== "" && t.final != null) vm.extra = `→ ${t.final}`;
    } else if (t.type === "clock") {
      vm.clock = true;
      vm.status = "running";
      const parts = clockParts(t, now);
      vm.time = parts.text;
      vm.extra = parts.sub;
      vm.progress = parts.s / 60;
      vm.hands = parts;
    }
    return vm;
  };

  function clockParts(t, now) {
    const d = new Date(now);
    let h, m, s, sub = "";
    try {
      const opts = { hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" };
      if (t.tz) opts.timeZone = t.tz;
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", opts).formatToParts(d).map((x) => [x.type, x.value]));
      h = +p.hour % 24; m = +p.minute; s = +p.second;
      sub = t.tz ? t.tz.split("/").pop().replace(/_/g, " ") : "Local";
    } catch (e) {
      h = d.getHours(); m = d.getMinutes(); s = d.getSeconds(); sub = "Local";
    }
    let hh = h, ampm = "";
    if (t.hour12) { ampm = h >= 12 ? "PM" : "AM"; hh = h % 12 || 12; }
    const text = `${t.hour12 ? hh : U.pad(hh)}:${U.pad(m)}${t.seconds ? `<span class="sec">${U.pad(s)}</span>` : ""}${ampm ? `<span class="u"> ${ampm}</span>` : ""}`;
    return { h, m, s, text, sub };
  }

  /* ---------- markup ---------- */
  const ring = (vm, dashed) => `
    <svg class="mt-svg" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="track" cx="50" cy="50" r="45"></circle>
      <circle class="bar ${dashed ? "dashed" : ""}" cx="50" cy="50" r="45" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - vm.progress)}"></circle>
      ${vm.clock && vm.analog ? analog(vm.hands) : ""}
    </svg>`;

  function analog(p) {
    const hand = (deg, len, w, cls) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `<line class="${cls}" x1="50" y1="50" x2="${50 + Math.cos(a) * len}" y2="${50 + Math.sin(a) * len}" stroke-width="${w}" stroke-linecap="round"></line>`;
    };
    let ticks = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180;
      ticks += `<line class="tick" x1="${50 + Math.cos(a) * 36}" y1="${50 + Math.sin(a) * 36}" x2="${50 + Math.cos(a) * 40}" y2="${50 + Math.sin(a) * 40}"></line>`;
    }
    return `<g class="analog">${ticks}${hand((p.h % 12) * 30 + p.m * 0.5, 20, 3.5, "hand")}${hand(p.m * 6 + p.s * 0.1, 30, 2.4, "hand")}${hand(p.s * 6, 33, 1, "hand sec-hand")}<circle cx="50" cy="50" r="2" class="hub"></circle></g>`;
  }

  R.cellInner = (el, now, { big = false } = {}) => {
    if (el.type === "buttons") return R.buttonsInner(el);
    const vm = R.vm(el, now);
    const t = E.target(el) || el;
    if (t.type === "clock" && t.dial === "analog") vm.analog = true;
    const anim = S.state.settings.waitingAnimation ? "anim" : "";
    const isContainer = el.type === "container";
    return `
      <div class="mt-ring ${anim} ${vm.analog ? "is-analog" : ""}" data-status="${vm.status}" style="--c:${vm.color}">
        ${ring(vm, vm.dashed)}
        <div class="mt-center">
          ${vm.analog ? "" : `<div class="mt-time">${vm.time}</div>`}
          <div class="mt-label">${U.esc(vm.label)}</div>
          <div class="mt-extra">${vm.extra || ""}</div>
        </div>
        ${vm.icon ? `<div class="mt-badge"><i class="fa-solid fa-${U.esc(vm.icon)}"></i></div>` : ""}
        ${vm.counter ? `<button class="mt-ctr minus" data-act="ctr-dec" aria-label="Decrease"><i class="fa-solid fa-minus"></i></button><button class="mt-ctr plus" data-act="ctr-inc" aria-label="Increase"><i class="fa-solid fa-plus"></i></button>` : ""}
        ${isContainer ? `<div class="mt-container-chip"><i class="fa-solid fa-box-open"></i></div>` : ""}
      </div>`;
  };

  R.buttonsInner = (el) => {
    const pills = (el.buttons || []).slice(0, 3)
      .map((b, i) => `<button class="mt-pill" data-act="pill" data-bi="${i}" style="--c:${b.color}">${U.esc(b.label || `Button (${i})`)}</button>`)
      .join("");
    return `<div class="mt-pills">${pills || `<span class="mt-sub">No buttons</span>`}</div>`;
  };

  R.cell = (el, now, editing) =>
    `<div class="mt-cell ${editing ? "editing" : ""} ${el.type === "container" ? "is-container" : ""} ${el.type === "buttons" ? "is-buttons" : ""}" data-id="${el.id}" data-type="${el.type}" tabindex="0" aria-label="${U.esc(S.elementLabel(el))}">
      ${R.cellInner(el, now)}
    </div>`;

  /** Updates live parts of rendered cells without rebuilding the grid. */
  R.patch = (scope, now) => {
    scope.querySelectorAll(".mt-cell[data-id], .mt-single[data-id]").forEach((node) => {
      const f = S.find(node.dataset.id);
      if (!f || f.el.type === "buttons") return;
      const el = f.el;
      const vm = R.vm(el, now);
      const ringEl = node.querySelector(".mt-ring");
      if (!ringEl) return;
      if (ringEl.dataset.status !== vm.status) ringEl.dataset.status = vm.status;
      ringEl.style.setProperty("--c", vm.color);
      const bar = ringEl.querySelector(".bar");
      if (bar) bar.setAttribute("stroke-dashoffset", C * (1 - vm.progress));
      const tm = ringEl.querySelector(".mt-time");
      if (tm && tm.innerHTML !== vm.time) tm.innerHTML = vm.time;
      const lb = ringEl.querySelector(".mt-label");
      if (lb && lb.textContent !== vm.label) lb.textContent = vm.label;
      const ex = ringEl.querySelector(".mt-extra");
      if (ex && ex.innerHTML !== (vm.extra || "")) ex.innerHTML = vm.extra || "";
      if (vm.analog || (E.target(el) || {}).dial === "analog") {
        const g = ringEl.querySelector(".analog");
        if (g) { vm.analog = true; g.outerHTML = analog(vm.hands); }
      }
    });
  };

  R.gridStyle = (board) =>
    board.columns ? `grid-template-columns: repeat(${board.columns}, minmax(0, 1fr));` : "";
})(window.MT);
