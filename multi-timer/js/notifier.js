/* Multi Timer — notifier window: receives alarm schedules from the embedded widget (its opener)
 * and shows desktop notifications on time. Notification button clicks are sent back to the widget. */
(function (MT) {
  const core = MT.notifyCore, U = MT.util;
  const $ = (id) => document.getElementById(id);
  let items = [];
  const fired = new Map();
  let lastMsg = 0;

  const opener = () => { try { return window.opener && !window.opener.closed ? window.opener : null; } catch (e) { return null; } };
  const post = (msg) => { const o = opener(); if (o) try { o.postMessage(msg, location.origin); } catch (e) {} };
  const perm = () => (core.supported() ? Notification.permission : "unsupported");
  const hello = () => post({ type: "mt-notifier-hello", permission: perm() });

  function fire(item) {
    if (!item || fired.has(item.key)) return;
    fired.set(item.key, Date.now());
    core.show(item);
  }

  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data.type !== "string") return;
    lastMsg = Date.now();
    const d = e.data;
    if (d.type === "mt-schedule") { items = Array.isArray(d.items) ? d.items : []; render(); }
    else if (d.type === "mt-fire") fire(d.item);
    else if (d.type === "mt-clear") core.clear(d.id);
  });

  core.listen((d) => {
    if (d.action === "open") { try { window.focus(); } catch (e) {} }
    post({ type: "mt-notif-action", action: d.action, id: d.id });
  });

  function render() {
    const p = perm();
    const pd = $("nt-perm-dot"), cd = $("nt-conn-dot");
    pd.className = "nt-dot " + (p === "granted" ? "ok" : p === "denied" || p === "unsupported" ? "bad" : "warn");
    $("nt-perm").textContent = p === "granted" ? "Notifications allowed"
      : p === "denied" ? "Notifications blocked — allow them for this site in the address bar, then reload this window"
      : p === "unsupported" ? "This browser doesn't support notifications"
      : "Click “Allow notifications” below";
    $("nt-allow").style.display = p === "default" ? "" : "none";
    $("nt-test").disabled = p !== "granted";
    const connected = Date.now() - lastMsg < 10000;
    cd.className = "nt-dot " + (connected ? "ok" : opener() ? "warn" : "bad");
    $("nt-conn").textContent = connected ? "Connected to Multi Timer"
      : opener() ? "Waiting for Multi Timer… keep the Notion page open"
      : "Not connected — in Notion, open Multi Timer → Settings → Alert settings → Reopen";
    const now = Date.now();
    const list = items.filter((i) => i.at > now - 1000).sort((a, b) => a.at - b.at);
    $("nt-list").innerHTML = list.length
      ? list.map((i) => `<div class="nt-item"><span class="nt-swatch" style="background:${U.esc(i.color)}"></span>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(i.title.replace(/^⏰ /, ""))}</span>
          <span class="mt-sub">${U.fmtClock(i.at, false)}</span><span class="nt-in">${U.plainTime(i.at - now)}</span></div>`).join("")
      : `<div class="nt-item mt-sub">No running timers</div>`;
    document.title = list.length ? `🔔 ${list.length} · Notifier` : "Notifier · Multi Timer";
  }

  $("nt-allow").addEventListener("click", async () => {
    if (!core.supported()) return;
    await Notification.requestPermission();
    if (perm() === "granted") core.registerSW();
    hello();
    render();
  });
  $("nt-test").addEventListener("click", () =>
    core.show({ id: "test", title: "Multi Timer", body: "Desktop notifications are working", color: "#a855f7", final: false }));

  if (perm() === "granted") core.registerSW();
  let n = 0;
  core.ticker(() => {
    const now = Date.now();
    items.forEach((i) => { if (i.at <= now && now - i.at < 60000) fire(i); });
    fired.forEach((t, k) => { if (now - t > 600000) fired.delete(k); });
    if (n++ % 12 === 0) hello(); // every 3 s
    if (n % 4 === 0) render();
  }, 250);
  hello();
  render();
  window.MTN = { fire, post, items: () => items }; // used by tests
})(window.MT);
