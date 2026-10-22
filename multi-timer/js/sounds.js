/* Multi Timer — alert sounds (WebAudio built-ins + custom uploads in IndexedDB) */
window.MT = window.MT || {};
(function (MT) {
  const SND = (MT.sounds = {});

  SND.builtins = [
    { id: "silent", name: "Silent", dur: 0 },
    { id: "alarm", name: "Alarm", dur: 6 },
    { id: "beep", name: "Beep", dur: 1.2 },
    { id: "chime", name: "Chime", dur: 2.5 },
    { id: "bell", name: "Bell", dur: 3.5 },
    { id: "digital", name: "Digital", dur: 3.2 },
    { id: "soft", name: "Soft", dur: 2.4 },
  ];

  let ctx = null;
  const ac = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  SND.unlock = () => { try { ac(); } catch (e) {} };

  function tone(c, out, f, t, d, type = "sine", g = 0.3) {
    const o = c.createOscillator(), gn = c.createGain();
    o.type = type;
    o.frequency.value = f;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }

  const PATTERNS = {
    alarm(c, o, t) { for (let i = 0; i < 12; i++) tone(c, o, i % 2 ? 880 : 660, t + i * 0.5, 0.42, "square", 0.12); },
    beep(c, o, t) { for (let i = 0; i < 3; i++) tone(c, o, 1000, t + i * 0.35, 0.22, "square", 0.14); },
    chime(c, o, t) { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, o, f, t + i * 0.22, 1.6, "sine", 0.3)); },
    bell(c, o, t) {
      [0, 1.2].forEach((dt) => { tone(c, o, 880, t + dt, 2.2, "sine", 0.35); tone(c, o, 1760, t + dt, 1.4, "sine", 0.12); tone(c, o, 2640, t + dt, 0.8, "sine", 0.06); });
    },
    digital(c, o, t) { for (let g = 0; g < 4; g++) for (let i = 0; i < 4; i++) tone(c, o, 2000, t + g * 0.8 + i * 0.1, 0.06, "square", 0.1); },
    soft(c, o, t) { tone(c, o, 440, t, 1.2, "sine", 0.25); tone(c, o, 554.37, t + 0.6, 1.6, "sine", 0.22); },
  };

  /* ---------- IndexedDB for custom sounds ---------- */
  let dbp = null;
  const db = () =>
    dbp ||
    (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("multiTimer", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("sounds", { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  const idb = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction("sounds", mode);
      const req = fn(tx.objectStore("sounds"));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  };

  SND.list = () => [...SND.builtins, ...MT.store.state.customSounds];
  SND.name = (id) => (SND.list().find((s) => s.id === id) || {}).name || "Alarm";

  SND.addCustom = async (file) => {
    const id = "custom:" + MT.util.uid();
    const meta = { id, name: file.name.replace(/\.[^.]+$/, ""), custom: true };
    await idb("readwrite", (st) => st.put({ id, blob: file }));
    MT.store.state.customSounds.push(meta);
    MT.store.save();
    return meta;
  };
  SND.removeCustom = async (id) => {
    MT.store.state.customSounds = MT.store.state.customSounds.filter((s) => s.id !== id);
    MT.store.save();
    try { await idb("readwrite", (st) => st.delete(id)); } catch (e) {}
  };

  /**
   * Plays a sound. repeat: number of plays (0 = loop until stopped, max 10 minutes).
   * Returns a handle with stop().
   */
  SND.play = (id, { volume = MT.store.state.settings.volume, repeat = 1 } = {}) => {
    const handle = { stopped: false, timers: [], stop() {} };
    if (!id || id === "silent" || volume <= 0) return handle;
    const loops = repeat === 0 ? Infinity : Math.max(1, repeat);
    const startedAt = Date.now();

    if (id.startsWith("custom:")) {
      let audio = null, url = null, plays = 0;
      handle.stop = () => {
        handle.stopped = true;
        if (audio) { audio.pause(); audio.src = ""; }
        if (url) URL.revokeObjectURL(url);
      };
      idb("readonly", (st) => st.get(id))
        .then((rec) => {
          if (!rec || handle.stopped) return;
          url = URL.createObjectURL(rec.blob);
          audio = new Audio(url);
          audio.volume = Math.min(1, volume);
          audio.onended = () => {
            plays++;
            if (!handle.stopped && plays < loops && Date.now() - startedAt < 600000) audio.play().catch(() => {});
          };
          audio.play().catch(() => {});
        })
        .catch(() => {});
      return handle;
    }

    const pat = PATTERNS[id] || PATTERNS.alarm;
    const meta = SND.builtins.find((s) => s.id === id) || SND.builtins[1];
    let c;
    try { c = ac(); } catch (e) { return handle; }
    const master = c.createGain();
    master.gain.value = Math.min(1, volume);
    master.connect(c.destination);
    let n = 0;
    const playOnce = () => {
      if (handle.stopped || n >= loops || Date.now() - startedAt > 600000) return;
      n++;
      pat(c, master, c.currentTime + 0.02);
      handle.timers.push(setTimeout(playOnce, (meta.dur + 0.6) * 1000));
    };
    playOnce();
    handle.stop = () => {
      handle.stopped = true;
      handle.timers.forEach(clearTimeout);
      try { master.disconnect(); } catch (e) {}
    };
    return handle;
  };

  SND.vibrate = (pattern = [400, 200, 400, 200, 400]) => {
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {}
  };
})(window.MT);
