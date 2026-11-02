/* Multi Timer — Android app bridge (Capacitor). Inert in the browser: it only runs when the app
 * shell provides window.Capacitor (native platform) and window.CapPlugins (android-app/src/plugins.js). */
window.MT = window.MT || {};
(function (MT) {
  const P = window.CapPlugins;
  if (!P || !P.Capacitor || !P.Capacitor.isNativePlatform()) return;
  const { App, Filesystem, Haptics, KeepAwake, LocalNotifications: LN, Preferences, Share, SystemBars } = P;
  const U = MT.util, S = MT.store, E = MT.engine;
  const NV = (MT.native = {});
  const KEY = S.KEY;
  const CH_ALARM = "timer-alarms", CH_STEP = "timer-steps";
  const TEST_ID = 1;
  document.documentElement.classList.add("is-native");

  let foreground = true;
  let perm = "prompt";
  let exact = "granted";
  const scheduled = new Map(); // "elementId@second" -> notification id

  /* ---------- storage: mirror saves into Android SharedPreferences ---------- */
  NV.persist = (json) => { Preferences.set({ key: KEY, value: json }).catch(() => {}); };

  /* ---------- background / foreground ---------- */
  NV.inBackground = () => !foreground;
  const onBackground = () => {
    if (!foreground) return;
    foreground = false;
    S.saveNow();
    scheduleUpcoming();
  };
  const onForeground = () => {
    if (foreground) return;
    foreground = true;
    cancelPending();
    refreshPerm().then(() => MT.app && MT.app.queueRender());
  };

  /* ---------- notifications ---------- */
  // 31-bit positive id from a string (Android notification ids are Java ints)
  const idFor = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 1) || 2;
  };

  async function refreshPerm() {
    try { perm = (await LN.checkPermissions()).display; } catch (e) {}
    try { exact = (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { exact = "granted"; }
  }

  /** Every alarm a running timer will raise, assuming nobody touches it (covers the app being closed). */
  NV.project = (el, now, boardName) => {
    const rt = el.rt || {};
    const out = [];
    if (E.isSegmented(el)) {
      const segs = E.segments(el);
      if (!segs.length) return out;
      let t, idx, cyc;
      if (rt.status === "running") { t = rt.endsAt; idx = rt.segIndex || 0; cyc = rt.cycle || 0; }
      else if (rt.status === "waiting" && rt.delayUntil) { t = rt.delayUntil + segs[0].dur; idx = 0; cyc = 0; }
      else return out;
      const cycles = E.cycles(el);
      for (let guard = 0; guard < 40 && t - now < 2 * U.DAY; guard++) {
        let ni = idx + 1, nc = cyc;
        if (ni >= segs.length) { ni = 0; nc++; }
        const done = ni === 0 && nc >= cycles;
        out.push({ el, at: t, final: done, label: done ? "" : segs[ni].name, board: boardName });
        if ((done && !el.autoRepeat) || (!done && el.pauseBetween)) break;
        if (done) { ni = 0; nc = 0; }
        idx = ni; cyc = nc;
        t += segs[idx].dur;
      }
    } else if (el.type === "countup" && rt.status === "running") {
      (el.milestones || []).filter((m) => m > 0 && !(rt.fired || []).includes(m)).forEach((m) =>
        out.push({ el, at: E.milestoneAt(el, m), final: false, label: "Milestone " + U.fmtHuman(m), board: boardName }));
    }
    return out.filter((x) => x.at > now + 500);
  };

  const notification = (item, id) => {
    const name = S.elementLabel(item.el);
    const text = MT.notifyCore.text({ name, final: item.final, label: item.label, board: item.board });
    return {
      id,
      title: text.title,
      body: text.body,
      channelId: item.final ? CH_ALARM : CH_STEP,
      actionTypeId: item.final ? "final" : undefined,
      schedule: { at: new Date(item.at), allowWhileIdle: true },
      extra: { elId: item.el.id },
      autoCancel: true,
    };
  };

  /** Brings the scheduled Android alarms in line with the running timers (only while the app is in the background). */
  async function scheduleUpcoming() {
    if (foreground || !S.state.settings.desktopNotifications || perm !== "granted") return;
    const now = Date.now();
    const items = S.allElements()
      .flatMap(({ el, board }) => NV.project(el, now, board.name))
      .sort((a, b) => a.at - b.at)
      .slice(0, 60);
    const want = new Map(items.map((i) => [i.el.id + "@" + Math.round(i.at / 1000), i]));
    const drop = [...scheduled.entries()].filter(([k]) => !want.has(k));
    try {
      if (drop.length) await LN.cancel({ notifications: drop.map(([, id]) => ({ id })) });
      drop.forEach(([k]) => scheduled.delete(k));
      const add = [...want.entries()].filter(([k]) => !scheduled.has(k)).map(([k, item]) => {
        const id = idFor(k);
        scheduled.set(k, id);
        return notification(item, id);
      });
      if (add.length) await LN.schedule({ notifications: add });
    } catch (e) {
      console.warn("Multi Timer: scheduling alarms failed", e);
    }
  }

  async function cancelPending() {
    scheduled.clear();
    try {
      const { notifications } = await LN.getPending();
      const ids = notifications.filter((n) => n.id !== TEST_ID).map((n) => ({ id: n.id }));
      if (ids.length) await LN.cancel({ notifications: ids });
    } catch (e) {}
  }

  async function setupNotifications() {
    try {
      await LN.createChannel({ id: CH_ALARM, name: "Timer alarms", description: "A timer has finished", importance: 5, visibility: 1, sound: "alarm.wav", vibration: true, lights: true, lightColor: "#A855F7" });
      await LN.createChannel({ id: CH_STEP, name: "Interval changes", description: "Next interval, break or count-up milestone", importance: 4, visibility: 1, sound: "chime.wav", vibration: true });
      await LN.registerActionTypes({ types: [{ id: "final", actions: [{ id: "stop", title: "Stop" }, { id: "add", title: "+1 min" }] }] });
      await LN.addListener("localNotificationActionPerformed", (e) => {
        const id = e.notification && e.notification.extra && e.notification.extra.elId;
        if (!id) return;
        const run = () => MT.notify.handleAction({ action: e.actionId === "tap" ? "open" : e.actionId, id });
        MT.app && MT.app.started ? run() : (NV.pendingAction = run);
      });
    } catch (e) {
      console.warn("Multi Timer: notification setup failed", e);
    }
    await refreshPerm();
  }

  NV.openExactSettings = async () => {
    try { exact = (await LN.changeExactNotificationSetting()).exact_alarm; } catch (e) {}
    MT.app.queueRender();
  };

  // notify.js integration: replace the browser/notifier-window paths with Android alarms
  const N = MT.notify;
  N.crossOriginFrame = () => false;
  N.boot = () => {};
  N.heartbeat = () => {};
  N.openNotifier = () => {};
  N.alarm = () => {}; // foreground: the in-app alarm rings; background: the scheduled Android alarm rings
  N.sendSchedule = () => { scheduleUpcoming(); };
  N.clear = () => {};
  N.state = () => {
    if (!S.state.settings.desktopNotifications) return perm === "denied" ? "native-blocked" : "native-off";
    if (perm !== "granted") return perm === "denied" ? "native-blocked" : "native-off";
    if (exact !== "granted") return "native-exact";
    return "native-on";
  };
  N.shouldPrompt = () =>
    !S.state.settings.desktopNotifications && !S.state.settings.notifPromptDismissed && perm !== "denied" &&
    S.activeBoard().elements.some((e) => E.hasRuntime(e) || e.type === "container");
  N.enable = async () => {
    let r = perm;
    try { r = (await LN.requestPermissions()).display; } catch (e) {}
    perm = r;
    if (r !== "granted") {
      MT.ui.toast("Notifications are off for Multi Timer — allow them in Android settings", "error");
      MT.app.queueRender();
      return;
    }
    S.state.settings.desktopNotifications = true;
    S.save();
    await refreshPerm();
    if (exact !== "granted") await NV.openExactSettings();
    MT.ui.toast("Alarm notifications on — they ring even when the app is closed");
    MT.app.queueRender();
  };
  N.disable = async () => {
    S.state.settings.desktopNotifications = false;
    S.save();
    await cancelPending();
    MT.app.queueRender();
  };
  N.test = () => {
    LN.schedule({ notifications: [{ id: TEST_ID, title: "⏰ Multi Timer", body: "Alarm notifications are working", channelId: CH_ALARM, schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true } }] }).catch(() => {});
  };

  /* ---------- keep screen on, vibration, files ---------- */
  let awake = false;
  NV.keepAwake = (want) => {
    if (want === awake) return;
    awake = want;
    (want ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {});
  };

  NV.vibrate = (pattern = [400]) => {
    const ms = Math.min(3000, pattern.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0));
    Haptics.vibrate({ duration: ms || 300 }).catch(() => {});
  };

  /** Exports: write to the app cache, then open the Android share sheet (Drive, Files, email…). */
  NV.saveFile = async (filename, blob) => {
    try {
      const data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
      const { uri } = await Filesystem.writeFile({ path: filename, data, directory: "CACHE" });
      await Share.share({ title: filename, files: [uri], dialogTitle: `Save or send ${filename}` });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) MT.ui.toast("Couldn't export the file", "error");
    }
  };

  /* ---------- status bar icons follow the widget's light/dark mode ---------- */
  const syncBars = () => {
    const dark = document.documentElement.classList.contains("dark");
    SystemBars.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {});
  };

  /* ---------- Android back button ---------- */
  const onBack = () => {
    const A = MT.app;
    const top = document.getElementById("overlay-root").lastElementChild;
    if (top) {
      const cancel = top.querySelector('[data-sheet="cancel"]');
      if (cancel) cancel.click();
      else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      return;
    }
    if (document.querySelector(".mt-alert-overlay")) { [...E.ringing.keys()].forEach((k) => E.stopRinging(k)); return; }
    if (A.drawerOpen) { MT.boards.openDrawer(false); return; }
    if (A.editMode) { MT.boards.exitEdit(true); return; }
    if (A.screen === "settings") { MT.settings.back(); return; }
    if (A.screen === "history") { MT.history.back(); return; }
    if (A.screen !== "board") { A.go("board"); return; }
    App.minimizeApp().catch(() => {});
  };

  /** Called before the app boots: restores data if the WebView storage was cleared, wires native events. */
  NV.init = async () => {
    try {
      const { value } = await Preferences.get({ key: KEY });
      if (value && !localStorage.getItem(KEY)) localStorage.setItem(KEY, value);
    } catch (e) {}
    // Android's file picker hides unknown extensions such as .mt when an accept list is set
    const fi = document.getElementById("file-import");
    if (fi) fi.removeAttribute("accept");
    await setupNotifications();
    await cancelPending(); // the app is open: in-app alarms take over from scheduled ones
    App.addListener("appStateChange", ({ isActive }) => (isActive ? onForeground() : onBackground()));
    App.addListener("backButton", onBack);
    document.addEventListener("visibilitychange", () => (document.hidden ? onBackground() : onForeground()));
    syncBars();
    new MutationObserver(syncBars).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  };

  /** Called right after the app has booted. */
  NV.afterBoot = () => {
    if (NV.pendingAction) { NV.pendingAction(); NV.pendingAction = null; }
  };
})(window.MT);
