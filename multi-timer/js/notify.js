/* Multi Timer — desktop notifications.
 * notifyCore: shared by the widget and notifier.html (service-worker notifications, icons, background ticker).
 * notify:     widget integration. Top-level pages notify directly; inside a cross-origin iframe (Notion embed)
 *             browsers block notification permission, so alarms are relayed to the notifier pop-up window. */
window.MT = window.MT || {};
(function (MT) {
  const core = (MT.notifyCore = { live: {} });
  const supported = (core.supported = () => "Notification" in window);

  /* Colored round clock icon per timer color. */
  const icons = {};
  core.icon = (color = "#a855f7") => {
    if (icons[color]) return icons[color];
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 96;
      const g = c.getContext("2d");
      g.fillStyle = color;
      g.beginPath(); g.arc(48, 48, 46, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.arc(48, 53, 25, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(48, 53); g.lineTo(48, 39); g.moveTo(48, 53); g.lineTo(59, 59); g.stroke();
      g.fillRect(40, 13, 16, 8);
      return (icons[color] = c.toDataURL("image/png"));
    } catch (e) {
      return undefined;
    }
  };

  let regP = null;
  core.registerSW = () => {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return Promise.resolve(null);
    if (!regP)
      regP = navigator.serviceWorker
        .register("sw.js")
        .then(() => navigator.serviceWorker.ready)
        .catch(() => null);
    return regP;
  };

  /** item: { id, title, body, color, final } */
  core.show = async (item) => {
    if (!supported() || Notification.permission !== "granted") return false;
    const opts = {
      body: item.body || "",
      tag: "mt-" + item.id,
      renotify: true,
      requireInteraction: !!item.final,
      icon: core.icon(item.color),
      data: { id: item.id },
    };
    if (item.final) opts.actions = [{ action: "stop", title: "Stop" }, { action: "add", title: "+1 min" }];
    const reg = await core.registerSW();
    if (reg) {
      try { await reg.showNotification(item.title, opts); return true; } catch (e) { /* fall back below */ }
    }
    try {
      delete opts.actions;
      const n = new Notification(item.title, opts);
      n.onclick = () => { window.focus(); n.close(); core.onAction && core.onAction({ action: "open", id: item.id }); };
      core.live[item.id] = n;
      return true;
    } catch (e) {
      return false;
    }
  };

  core.clear = async (id) => {
    const reg = regP && (await regP);
    if (reg) {
      try { (await reg.getNotifications({ tag: "mt-" + id })).forEach((n) => n.close()); } catch (e) {}
    }
    if (core.live[id]) { core.live[id].close(); delete core.live[id]; }
  };

  /** Receives notification button clicks forwarded by sw.js. */
  core.listen = (fn) => {
    core.onAction = fn;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data && e.data.type === "mt-notif-action") fn(e.data);
    });
    if (navigator.serviceWorker.startMessages) navigator.serviceWorker.startMessages();
  };

  /** Interval driven by a Web Worker: background tabs throttle page timers to ~1/min, workers are not throttled. */
  core.ticker = (fn, ms) => {
    try {
      const url = URL.createObjectURL(new Blob([`setInterval(function(){postMessage(0)},${ms})`], { type: "text/javascript" }));
      const w = new Worker(url);
      w.onmessage = fn;
      return w;
    } catch (e) {
      return setInterval(fn, ms);
    }
  };

  core.text = ({ name, final, label, board }) =>
    final
      ? { title: `⏰ ${name}`, body: `Time is up${board ? " · " + board : ""}` }
      : { title: `${name}: ${label || "next"}`, body: board || "" };
  core.key = (id, at) => id + "@" + Math.round((at || Date.now()) / 1000);

  /* ======================= widget integration ======================= */
  if (!MT.store) return;
  const S = MT.store, E = MT.engine, UI = MT.ui;
  const N = (MT.notify = { relay: null, relaySeen: 0, relayPerm: null });
  const set = () => S.state.settings;
  const A = () => MT.app;

  N.crossOriginFrame = () => {
    if (window.top === window) return false;
    try { return !window.top.location.href; } catch (e) { return true; }
  };
  N.relayAlive = () => {
    try { return !!N.relay && !N.relay.closed && Date.now() - N.relaySeen < 10000; } catch (e) { return false; }
  };

  /** off | on | blocked | unsupported | relay | relay-permission | relay-closed */
  N.state = () => {
    if (!supported()) return "unsupported";
    if (N.crossOriginFrame()) {
      if (!set().desktopNotifications) return "off";
      if (!N.relayAlive()) return "relay-closed";
      return N.relayPerm === "granted" ? "relay" : "relay-permission";
    }
    if (Notification.permission === "denied") return "blocked";
    return set().desktopNotifications && Notification.permission === "granted" ? "on" : "off";
  };

  let lastState = null;
  const stateChanged = () => {
    const s = N.state();
    if (s !== lastState) {
      lastState = s;
      if (A() && (A().screen === "settings" || A().screen === "board")) A().queueRender();
    }
  };

  N.shouldPrompt = () =>
    supported() && !set().desktopNotifications && !set().notifPromptDismissed &&
    (N.crossOriginFrame() || Notification.permission !== "denied") &&
    S.activeBoard().elements.some((e) => E.hasRuntime(e) || e.type === "container");

  /** Must run from a click: opens the permission prompt or the notifier window. */
  N.enable = async () => {
    if (!supported()) { UI.toast("This browser doesn't support notifications", "error"); return; }
    if (N.crossOriginFrame()) {
      set().desktopNotifications = true;
      S.save();
      N.openNotifier();
      stateChanged();
      return;
    }
    const p = await Notification.requestPermission();
    if (p === "granted") {
      set().desktopNotifications = true;
      S.save();
      await core.registerSW();
      core.show({ id: "test", title: "Multi Timer", body: "Desktop notifications are on", color: getBrand(), final: false });
      UI.toast("Desktop notifications on");
    } else {
      UI.toast("Notifications are blocked — allow them for this site in the address bar", "error");
    }
    stateChanged();
  };

  N.disable = () => {
    set().desktopNotifications = false;
    S.save();
    post({ type: "mt-schedule", items: [] });
    stateChanged();
  };

  N.openNotifier = () => {
    const url = new URL("notifier.html", location.href).href;
    let w = null;
    try { w = window.open(url, "mt-notifier", "popup=yes,width=380,height=560"); } catch (e) { w = null; }
    if (!w) {
      UI.dialog({
        title: "Pop-up blocked",
        body: `<p class="text-sm text-gray-600 dark:text-gray-300 mb-3">Notion or the browser blocked the notifier window. Open it with this link, then allow notifications in it.</p>
          <a href="${url}" target="_blank" rel="opener" class="mt-btn mt-btn-primary w-full">Open notifier window</a>`,
        buttons: [{ label: "Close", kind: "ghost" }],
      });
      return;
    }
    N.relay = w;
    try { w.focus(); } catch (e) {}
  };

  N.test = () => {
    const item = { id: "test", key: "test@" + Date.now(), title: "Multi Timer", body: "Desktop notifications are working", color: getBrand(), final: false };
    if (N.crossOriginFrame()) post({ type: "mt-fire", item });
    else core.show(item);
  };

  function getBrand() {
    return getComputedStyle(document.documentElement).getPropertyValue("--brand-color").trim() || "#a855f7";
  }
  function post(msg) {
    if (!N.relay) return;
    try { if (!N.relay.closed) N.relay.postMessage(msg, location.origin); } catch (e) {}
  }
  function itemFor(el, { final, label, at }) {
    const f = S.find(el.id);
    const board = f ? f.board.name : "";
    return { id: el.id, key: core.key(el.id, at), at, final, color: el.color, ...core.text({ name: S.elementLabel(el), final, label, board }) };
  }

  /** Called by the app for every non-silent alarm. */
  N.alarm = (el, opts = {}) => {
    if (!set().desktopNotifications) return;
    const item = itemFor(el, { final: !opts.short, label: opts.label, at: opts.at || Date.now() });
    if (N.crossOriginFrame()) post({ type: "mt-fire", item });
    else core.show(item);
  };

  N.clear = (id) => {
    if (N.crossOriginFrame()) post({ type: "mt-clear", id });
    else if (supported() && Notification.permission === "granted") core.clear(id);
  };

  /** Sends upcoming end times so the notifier fires on time even if this tab is throttled. */
  N.sendSchedule = () => {
    if (!N.crossOriginFrame() || !N.relay || !set().desktopNotifications) return;
    const now = Date.now();
    const items = E.upcoming(now).map((u) => {
      const f = S.find(u.id);
      return itemFor(f.el, { final: u.final, label: u.label, at: u.at });
    });
    post({ type: "mt-schedule", items });
  };

  N.handleAction = ({ action, id }) => {
    const f = id && S.find(id);
    const now = Date.now();
    if (action === "open") { try { window.focus(); } catch (e) {} return; }
    if (!f) return;
    const t = E.target(f.el) || f.el;
    if (action === "stop") E.stopRinging(t.id);
    else if (action === "add") E.addTime(t, 60000, now);
    else if (action === "reset") E.reset(t, now);
    A().queueRender();
  };

  N.boot = () => {
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin || !e.data || typeof e.data.type !== "string") return;
      if (e.data.type === "mt-notifier-hello") {
        N.relay = e.source;
        N.relaySeen = Date.now();
        N.relayPerm = e.data.permission;
        N.sendSchedule();
        stateChanged();
      } else if (e.data.type === "mt-notif-action") N.handleAction(e.data);
    });
    if (!N.crossOriginFrame()) {
      core.listen(N.handleAction);
      if (set().desktopNotifications && supported() && Notification.permission === "granted") core.registerSW();
    }
    lastState = N.state();
  };
  N.heartbeat = () => { N.sendSchedule(); stateChanged(); };
})(window.MT);
