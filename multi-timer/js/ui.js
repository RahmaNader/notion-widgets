/* Multi Timer — generic UI components: dialogs, menus, keypad, sheets, toasts */
window.MT = window.MT || {};
(function (MT) {
  const U = MT.util;
  const UI = (MT.ui = {});
  const root = () => document.getElementById("overlay-root");

  /** Low-level overlay. Returns { el, close }. */
  UI.open = (html, { cls = "", onClose, dismissible = true, z = 2000 } = {}) => {
    const wrap = document.createElement("div");
    wrap.className = "mt-overlay " + cls;
    wrap.style.zIndex = z + root().children.length;
    wrap.innerHTML = html;
    root().appendChild(wrap);
    let closed = false;
    const close = (v) => {
      if (closed) return;
      closed = true;
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      onClose && onClose(v);
    };
    const onKey = (e) => { if (e.key === "Escape" && dismissible && root().lastElementChild === wrap) close(null); };
    document.addEventListener("keydown", onKey);
    if (dismissible) wrap.addEventListener("pointerdown", (e) => { if (e.target === wrap) wrap._down = true; });
    if (dismissible) wrap.addEventListener("click", (e) => { if (e.target === wrap && wrap._down) close(null); wrap._down = false; });
    return { el: wrap, close };
  };

  /** Standard modal dialog. buttons: [{label, kind:'primary'|'ghost'|'danger', value, onClick(close) }] */
  UI.dialog = ({ title = "", body = "", buttons = [{ label: "Close", kind: "ghost" }], onMount, wide = false, dismissible = true, onClose } = {}) => {
    const btns = buttons
      .map((b, i) => `<button data-dlg-btn="${i}" class="mt-btn mt-btn-${b.kind || "ghost"}" ${b.id ? `id="${b.id}"` : ""}>${U.esc(b.label)}</button>`)
      .join("");
    const o = UI.open(
      `<div class="mt-dialog ${wide ? "mt-dialog-wide" : ""}" role="dialog" aria-modal="true">
        ${title ? `<h3 class="mt-dialog-title">${title}</h3>` : ""}
        <div class="mt-dialog-body">${body}</div>
        ${btns ? `<div class="mt-dialog-actions">${btns}</div>` : ""}
      </div>`,
      { dismissible, onClose }
    );
    o.el.querySelectorAll("[data-dlg-btn]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const b = buttons[+btn.dataset.dlgBtn];
        if (b.onClick) { if (b.onClick(o.close, o.el) !== false && b.closes !== false) o.close(b.value); }
        else o.close(b.value);
      })
    );
    onMount && onMount(o.el, o.close);
    const first = o.el.querySelector("input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select");
    if (first) setTimeout(() => first.focus(), 30);
    return o;
  };

  UI.confirm = (message, { title = "Are you sure?", okLabel = "OK", danger = false } = {}) =>
    new Promise((res) => {
      UI.dialog({
        title: U.esc(title),
        body: `<p class="text-sm text-gray-600 dark:text-gray-300">${message}</p>`,
        buttons: [
          { label: "Cancel", kind: "ghost", value: false },
          { label: okLabel, kind: danger ? "danger" : "primary", value: true },
        ],
        onClose: (v) => res(!!v),
      });
    });

  UI.alert = (message, title = "") =>
    new Promise((res) => UI.dialog({ title: U.esc(title), body: `<div class="text-sm text-gray-600 dark:text-gray-300">${message}</div>`, buttons: [{ label: "OK", kind: "primary" }], onClose: res }));

  UI.prompt = (title, value = "", { placeholder = "", okLabel = "Done", type = "text" } = {}) =>
    new Promise((res) => {
      let result = null;
      const o = UI.dialog({
        title: U.esc(title),
        body: `<input id="mt-prompt" type="${type}" class="mt-input" value="${U.esc(value)}" placeholder="${U.esc(placeholder)}" />`,
        buttons: [
          { label: "Cancel", kind: "ghost" },
          { label: okLabel, kind: "primary", onClick: (close, el) => { result = el.querySelector("#mt-prompt").value; } },
        ],
        onClose: () => res(result),
      });
      o.el.querySelector("#mt-prompt").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { result = e.target.value; o.close(); }
      });
    });

  /** Radio list chooser. options: [{value,label,sub}] */
  UI.choose = (title, options, current) =>
    new Promise((res) => {
      let result;
      const body = `<div class="mt-choice-list">${options
        .map((o, i) => `<button class="mt-choice ${o.value === current ? "active" : ""}" data-i="${i}">
            <span class="mt-radio"></span><span class="flex-1 text-left"><span class="block">${U.esc(o.label)}</span>${o.sub ? `<span class="mt-sub">${U.esc(o.sub)}</span>` : ""}</span>
            ${o.color ? `<span class="w-3 h-3 rounded-full" style="background:${o.color}"></span>` : ""}
          </button>`)
        .join("")}</div>`;
      const o = UI.dialog({ title: U.esc(title), body, buttons: [{ label: "Cancel", kind: "ghost" }], onClose: () => res(result) });
      o.el.querySelectorAll(".mt-choice").forEach((b) =>
        b.addEventListener("click", () => { result = options[+b.dataset.i].value; o.close(); })
      );
    });

  /** Multi-select checklist. Returns array of values or null. */
  UI.checklist = (title, options, { okLabel = "Done", all = true } = {}) =>
    new Promise((res) => {
      let result = null;
      const body = `<div class="mt-choice-list">${options
        .map((o, i) => `<label class="mt-choice"><input type="checkbox" class="mt-check" data-i="${i}" ${o.checked ? "checked" : ""}/><span class="flex-1 text-left">${U.esc(o.label)}</span></label>`)
        .join("")}</div>
        ${all ? `<button class="mt-link mt-toggle-all mt-1">Select all / none</button>` : ""}`;
      const o = UI.dialog({
        title: U.esc(title), body,
        buttons: [
          { label: "Cancel", kind: "ghost" },
          { label: okLabel, kind: "primary", onClick: (c, el) => { result = [...el.querySelectorAll(".mt-check:checked")].map((x) => options[+x.dataset.i].value); } },
        ],
        onClose: () => res(result),
      });
      const t = o.el.querySelector(".mt-toggle-all");
      t && t.addEventListener("click", () => {
        const boxes = [...o.el.querySelectorAll(".mt-check")];
        const anyOff = boxes.some((b) => !b.checked);
        boxes.forEach((b) => (b.checked = anyOff));
      });
    });

  /** Context menu at viewport coords. items: [{label, icon, onClick, danger, disabled}] or '-' */
  UI.menu = (x, y, items) => {
    const html = `<div class="mt-menu">${items
      .map((it, i) => it === "-" ? `<div class="mt-menu-sep"></div>` :
        `<button class="mt-menu-item ${it.danger ? "danger" : ""}" data-i="${i}" ${it.disabled ? "disabled" : ""}>
          ${it.icon ? `<i class="fa-solid fa-${it.icon} w-5 text-center"></i>` : ""}<span>${U.esc(it.label)}</span></button>`)
      .join("")}</div>`;
    const o = UI.open(html, { cls: "mt-overlay-clear" });
    const m = o.el.querySelector(".mt-menu");
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + "px";
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + "px";
    m.querySelectorAll(".mt-menu-item").forEach((b) =>
      b.addEventListener("click", () => {
        o.close();
        const it = items[+b.dataset.i];
        it.onClick && it.onClick();
      })
    );
    return o;
  };
  UI.menuAt = (anchor, items) => {
    const r = anchor.getBoundingClientRect();
    return UI.menu(r.right - 220, r.bottom + 4, items);
  };

  /** Duration keypad (digits + DAYS/HOURS/MINUTES/SECONDS units). Resolves ms or null. */
  UI.keypad = (title = "Time", { initial = 0, allowNegative = false, okLabel = "OK", allowZero = false } = {}) =>
    new Promise((res) => {
      const parts = {};
      let buf = "", neg = initial < 0, result = null;
      if (initial) {
        const p = U.split(initial);
        ["d", "h", "m", "s"].forEach((k) => { if (p[k]) parts[k] = p[k]; });
      }
      const order = ["d", "h", "m", "s"];
      const labels = { d: "DAYS", h: "HOURS", m: "MINUTES", s: "SECONDS" };
      const keys = ["7", "8", "9", "d", "4", "5", "6", "h", "1", "2", "3", "m", "±", "0", "⌫", "s"];
      const body = `
        <div class="mt-keypad">
          <div class="mt-keypad-display" id="kp-display"></div>
          <div class="mt-keypad-grid">
            ${keys.map((k) => {
              if (labels[k]) return `<button class="mt-key unit" data-k="${k}">${labels[k]}</button>`;
              if (k === "±") return `<button class="mt-key" data-k="±" ${allowNegative ? "" : "disabled"}>±</button>`;
              if (k === "⌫") return `<button class="mt-key" data-k="⌫"><i class="fa-solid fa-delete-left"></i></button>`;
              return `<button class="mt-key" data-k="${k}">${k}</button>`;
            }).join("")}
          </div>
          <p class="mt-sub text-center mt-2">Type a number, then tap a unit. Digits without a unit count as minutes.</p>
        </div>`;
      const compute = () => {
        const p = { ...parts };
        if (buf) p.m = (p.m || 0) + parseInt(buf, 10);
        const ms = (p.d || 0) * U.DAY + (p.h || 0) * U.HOUR + (p.m || 0) * U.MIN + (p.s || 0) * U.SEC;
        return neg ? -ms : ms;
      };
      const o = UI.dialog({
        title: U.esc(title), body,
        buttons: [
          { label: "Cancel", kind: "ghost" },
          { label: okLabel, kind: "primary", onClick: () => {
            const v = compute();
            if (!v && !allowZero) { UI.toast("Enter a time first"); return false; }
            result = v;
          } },
        ],
        onClose: () => res(result),
      });
      const disp = o.el.querySelector("#kp-display");
      const draw = () => {
        const txt = order.filter((k) => parts[k] != null).map((k) => `${parts[k]}<small>${k}</small>`).join(" ");
        disp.innerHTML = `${neg ? "−" : ""}${txt}${txt && buf ? " " : ""}${buf ? `<span class="buf">${buf}</span>` : ""}<span class="caret"></span>` || "0";
        if (!txt && !buf) disp.innerHTML = `<span class="text-gray-400">0</span><span class="caret"></span>`;
      };
      let fresh = !!initial; // first keystroke replaces the prefilled value
      const press = (k) => {
        if (fresh && k !== "±") {
          fresh = false;
          Object.keys(parts).forEach((x) => delete parts[x]);
          buf = "";
          if (k === "⌫") { draw(); return; }
        }
        if (/^\d$/.test(k)) { if (buf.length < 4) buf += k; }
        else if (labels[k]) { if (buf) { parts[k] = parseInt(buf, 10); buf = ""; } }
        else if (k === "⌫") {
          if (buf) buf = buf.slice(0, -1);
          else {
            const last = [...order].reverse().find((x) => parts[x] != null);
            if (last) { buf = String(parts[last]).slice(0, -1); delete parts[last]; }
          }
        } else if (k === "±" && allowNegative) neg = !neg;
        draw();
      };
      o.el.querySelectorAll(".mt-key").forEach((b) => b.addEventListener("click", () => press(b.dataset.k)));
      o.el.addEventListener("keydown", (e) => {
        const map = { d: "d", h: "h", m: "m", s: "s", Backspace: "⌫", "-": "±" };
        if (/^\d$/.test(e.key)) press(e.key);
        else if (map[e.key]) press(map[e.key]);
        else if (e.key === "Enter") o.el.querySelector('[data-dlg-btn="1"]').click();
        else return;
        e.preventDefault();
      });
      o.el.querySelector(".mt-dialog").tabIndex = -1;
      setTimeout(() => o.el.querySelector(".mt-dialog").focus(), 30);
      draw();
    });

  /** Full-screen sheet with Cancel / Done header. */
  UI.sheet = ({ title = "", body = "", doneLabel = "Done", onDone, onCancel, onMount, hideDone = false }) => {
    const o = UI.open(
      `<div class="mt-sheet">
        <div class="mt-sheet-header">
          <button class="mt-btn mt-btn-ghost" data-sheet="cancel">${hideDone ? '<i class="fa-solid fa-arrow-left"></i>' : "Cancel"}</button>
          <div class="mt-sheet-title">${title}</div>
          ${hideDone ? "<span class='w-16'></span>" : `<button class="mt-btn mt-btn-primary" data-sheet="done">${U.esc(doneLabel)}</button>`}
        </div>
        <div class="mt-sheet-body">${body}</div>
      </div>`,
      { cls: "mt-overlay-sheet", dismissible: false, z: 1500 }
    );
    o.el.querySelector('[data-sheet="cancel"]').addEventListener("click", () => { onCancel && onCancel(); o.close(); });
    const done = o.el.querySelector('[data-sheet="done"]');
    done && done.addEventListener("click", () => { if (!onDone || onDone(o.el) !== false) o.close(); });
    onMount && onMount(o.el, o.close);
    return o;
  };

  UI.toast = (msg, type = "info") => {
    const t = document.createElement("div");
    t.className = "mt-toast " + (type === "error" ? "error" : "");
    t.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${U.esc(msg)}</span>`;
    document.getElementById("toast-root").appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, type === "error" ? 4500 : 2600);
  };

  UI.switch = (id, checked, attrs = "") =>
    `<label class="mt-switch"><input type="checkbox" id="${id}" ${checked ? "checked" : ""} ${attrs}/><span></span></label>`;

  /** Color chooser dialog: native picker + saved custom colors. Resolves hex or null. */
  UI.colorPicker = (current) =>
    new Promise((res) => {
      let result = null;
      const st = MT.store.state;
      const swatches = () => [...U.PALETTE.map((p) => p.hex), ...st.customColors]
        .map((c, i) => `<button class="mt-swatch ${c === current ? "active" : ""}" data-c="${c}" style="--c:${c}">${i >= U.PALETTE.length ? `<span class="del" data-del="${c}">×</span>` : ""}</button>`).join("");
      const o = UI.dialog({
        title: "Color",
        body: `<div class="flex items-center gap-4 mb-4">
            <input type="color" id="cp-input" value="${current || "#a855f7"}" class="w-16 h-16 rounded-xl cursor-pointer bg-transparent border-0"/>
            <div class="flex-1"><div class="mt-sub mb-1">Selected</div><div id="cp-hex" class="font-mono text-sm">${current || "#a855f7"}</div>
            <button class="mt-link mt-1" id="cp-save"><i class="fa-solid fa-plus mr-1"></i>Save as custom color</button></div>
          </div>
          <div class="mt-swatches" id="cp-swatches">${swatches()}</div>`,
        buttons: [
          { label: "Cancel", kind: "ghost" },
          { label: "Select", kind: "primary", onClick: (c, el) => { result = el.querySelector("#cp-input").value; } },
        ],
        onClose: () => res(result),
      });
      const inp = o.el.querySelector("#cp-input");
      inp.addEventListener("input", () => (o.el.querySelector("#cp-hex").textContent = inp.value));
      o.el.querySelector("#cp-save").addEventListener("click", () => {
        if (!st.customColors.includes(inp.value)) { st.customColors.push(inp.value); MT.store.save(); }
        o.el.querySelector("#cp-swatches").innerHTML = swatches();
      });
      o.el.querySelector("#cp-swatches").addEventListener("click", (e) => {
        const del = e.target.closest("[data-del]");
        if (del) {
          e.stopPropagation();
          st.customColors = st.customColors.filter((c) => c !== del.dataset.del);
          MT.store.save();
          o.el.querySelector("#cp-swatches").innerHTML = swatches();
          return;
        }
        const sw = e.target.closest("[data-c]");
        if (sw) { inp.value = sw.dataset.c; o.el.querySelector("#cp-hex").textContent = sw.dataset.c; }
      });
    });

  /** Icon chooser with search. Resolves icon name, "" for no icon, or null on cancel. */
  UI.iconPicker = (current, query = "") =>
    new Promise((res) => {
      let result = null;
      const o = UI.dialog({
        title: "Icons",
        wide: true,
        body: `<div class="relative mb-3"><i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input id="ip-q" class="mt-input pl-9" placeholder="Search icons" value="${U.esc(query)}"/></div>
          <div class="mt-icon-grid" id="ip-grid"></div>`,
        buttons: [{ label: "Cancel", kind: "ghost" }],
        onClose: () => res(result),
      });
      const grid = o.el.querySelector("#ip-grid");
      const draw = (q) => {
        const list = MT.icons.search(q);
        grid.innerHTML = `<button class="mt-icon-btn ${!current ? "active" : ""}" data-icon="" title="No icon"><span class="text-[10px] font-bold leading-tight">NO<br>ICON</span></button>` +
          list.map((i) => `<button class="mt-icon-btn ${i.name === current ? "active" : ""}" data-icon="${i.name}" title="${i.name}"><i class="fa-solid fa-${i.name}"></i></button>`).join("") +
          (list.length ? "" : `<p class="col-span-full mt-sub py-4 text-center">No icons match.</p>`);
      };
      const q = o.el.querySelector("#ip-q");
      q.addEventListener("input", () => draw(q.value));
      grid.addEventListener("click", (e) => {
        const b = e.target.closest("[data-icon]");
        if (b) { result = b.dataset.icon; o.close(); }
      });
      draw(q.value);
    });
})(window.MT);
