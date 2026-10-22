/* Task Oracle — sorcerer & magic kitties (inline SVG, decorative) */
window.TO = window.TO || {};
(function (TO) {
  let uid = 0;
  const K = (TO.kitties = {});

  /** Sitting sorcerer cat in robe and wizard hat. variant: "wand" | "orb" */
  K.sorcerer = ({ variant = "wand", hat = "#7c3aed", robe = "#4c1d95", fur = "#2a1250" } = {}) => {
    const p = "k" + ++uid;
    const wand = `
      <g class="k-arm">
        <path d="M128 162 C 146 152, 154 140, 158 128" fill="none" stroke="url(#${p}robe)" stroke-width="16" stroke-linecap="round"/>
        <g class="k-wand">
          <line x1="158" y1="132" x2="186" y2="92" stroke="url(#${p}gold)" stroke-width="4" stroke-linecap="round"/>
          <path class="k-star" d="M187 78 l4.2 8.6 9.4 1.4 -6.8 6.6 1.6 9.4 -8.4 -4.4 -8.4 4.4 1.6 -9.4 -6.8 -6.6 9.4 -1.4z" fill="url(#${p}gold)" filter="url(#${p}glow)"/>
          <g class="k-sparkles" fill="#f5e3a3">
            <circle cx="168" cy="70" r="2.2"/><circle cx="198" cy="66" r="1.8"/><circle cx="176" cy="58" r="1.4"/>
            <path d="M200 92 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z"/>
            <path d="M162 92 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2z"/>
          </g>
        </g>
        <circle cx="158" cy="130" r="8.5" fill="${fur}" stroke="#a78bfa" stroke-opacity=".55" stroke-width="1.5"/>
      </g>`;
    const orb = `
      <g class="k-orb">
        <ellipse cx="100" cy="216" rx="26" ry="6" fill="#e2c97e" opacity=".85"/>
        <path d="M80 214 L86 204 L114 204 L120 214 Z" fill="url(#${p}gold)"/>
        <circle class="k-ball" cx="100" cy="182" r="24" fill="url(#${p}ball)" stroke="#ddd6fe" stroke-opacity=".7" stroke-width="1.5" filter="url(#${p}glow)"/>
        <path d="M88 170 q6 -8 14 -8" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle class="k-mist" cx="104" cy="188" r="9" fill="#f5e3a3" opacity=".35"/>
        <ellipse cx="80" cy="190" rx="10" ry="7.5" fill="${fur}" stroke="#a78bfa" stroke-opacity=".55" stroke-width="1.5"/>
        <ellipse cx="120" cy="190" rx="10" ry="7.5" fill="${fur}" stroke="#a78bfa" stroke-opacity=".55" stroke-width="1.5"/>
      </g>`;
    return `<svg class="k-svg" viewBox="0 0 210 240" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${p}robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${robe}"/><stop offset="1" stop-color="#14002a"/></linearGradient>
        <linearGradient id="${p}hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hat}"/><stop offset="1" stop-color="#1e0640"/></linearGradient>
        <linearGradient id="${p}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5e3a3"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
        <radialGradient id="${p}eye" cx=".4" cy=".35"><stop offset="0" stop-color="#fffbe0"/><stop offset=".6" stop-color="#f5e3a3"/><stop offset="1" stop-color="#d4a017"/></radialGradient>
        <radialGradient id="${p}ball" cx=".38" cy=".32"><stop offset="0" stop-color="#f5f0ff"/><stop offset=".35" stop-color="#c4b5fd"/><stop offset="1" stop-color="#5b21b6"/></radialGradient>
        <filter id="${p}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g class="k-body">
        <path class="k-tail" d="M140 218 C 186 214, 196 168, 172 156 C 160 150, 154 162, 164 166 C 178 172, 176 200, 140 204" fill="${fur}" stroke="#a78bfa" stroke-opacity=".5" stroke-width="2"/>
        <path d="M58 228 C 52 182, 70 140, 100 136 C 130 140, 148 182, 142 228 Z" fill="url(#${p}robe)" stroke="#a78bfa" stroke-opacity=".55" stroke-width="2"/>
        <path d="M76 200 l2.4 5 5.4 .8 -3.9 3.8 .9 5.4 -4.8 -2.6 -4.8 2.6 .9 -5.4 -3.9 -3.8 5.4 -.8z" fill="#e2c97e" opacity=".85"/>
        <path d="M118 182 a9 9 0 1 0 7 -13 a7 7 0 1 1 -7 13z" fill="#c4b5fd" opacity=".75"/>
        <circle cx="96" cy="216" r="1.8" fill="#f5e3a3" opacity=".8"/><circle cx="130" cy="210" r="1.4" fill="#f5e3a3" opacity=".7"/>
        <ellipse cx="84" cy="228" rx="13" ry="7" fill="${fur}" stroke="#a78bfa" stroke-opacity=".5" stroke-width="1.5"/>
        <ellipse cx="116" cy="228" rx="13" ry="7" fill="${fur}" stroke="#a78bfa" stroke-opacity=".5" stroke-width="1.5"/>
        <g class="k-head">
          <path d="M66 98 L50 60 L88 80 Z" fill="${fur}" stroke="#a78bfa" stroke-opacity=".55" stroke-width="1.5"/>
          <path d="M134 98 L150 60 L112 80 Z" fill="${fur}" stroke="#a78bfa" stroke-opacity=".55" stroke-width="1.5"/>
          <path d="M66 90 L56 67 L80 80 Z" fill="#c084fc" opacity=".5"/><path d="M134 90 L144 67 L120 80 Z" fill="#c084fc" opacity=".5"/>
          <ellipse cx="100" cy="108" rx="40" ry="34" fill="${fur}" stroke="#a78bfa" stroke-opacity=".55" stroke-width="1.5"/>
          <g class="k-eyes">
            <ellipse cx="85" cy="106" rx="8.5" ry="9.5" fill="url(#${p}eye)" filter="url(#${p}glow)"/>
            <ellipse cx="115" cy="106" rx="8.5" ry="9.5" fill="url(#${p}eye)" filter="url(#${p}glow)"/>
            <ellipse cx="85" cy="106" rx="2.4" ry="7.5" fill="#14002a"/><ellipse cx="115" cy="106" rx="2.4" ry="7.5" fill="#14002a"/>
            <circle cx="82.5" cy="102" r="1.8" fill="#fff"/><circle cx="112.5" cy="102" r="1.8" fill="#fff"/>
          </g>
          <path d="M96.5 117 h7 l-3.5 4 z" fill="#f0abfc"/>
          <path d="M93 123 q3.5 4 7 0 q3.5 4 7 0" fill="none" stroke="#c4b5fd" stroke-width="1.6" stroke-linecap="round"/>
          <g stroke="#c4b5fd" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round">
            <line x1="74" y1="117" x2="50" y2="113"/><line x1="74" y1="121" x2="50" y2="123"/>
            <line x1="126" y1="117" x2="150" y2="113"/><line x1="126" y1="121" x2="150" y2="123"/>
          </g>
          <g class="k-hat">
            <path d="M64 80 C 80 62, 86 26, 112 6 C 124 -2, 134 4, 128 12 C 118 22, 120 52, 138 80 Z" fill="url(#${p}hat)" stroke="#e2c97e" stroke-opacity=".7" stroke-width="1.5"/>
            <circle cx="131" cy="9" r="4.5" fill="url(#${p}gold)" filter="url(#${p}glow)"/>
            <path d="M70 72 Q 101 62 132 72 L 135 78 Q 101 68 67 78 Z" fill="url(#${p}gold)"/>
            <path d="M98 44 l1.8 3.8 4.2 .6 -3 3 .7 4.2 -3.7 -2 -3.7 2 .7 -4.2 -3 -3 4.2 -.6z" fill="#f5e3a3"/>
            <circle cx="88" cy="58" r="1.6" fill="#f5e3a3"/><circle cx="114" cy="30" r="1.3" fill="#f5e3a3"/>
            <ellipse cx="101" cy="80" rx="54" ry="9" fill="url(#${p}hat)" stroke="#e2c97e" stroke-opacity=".7" stroke-width="1.5"/>
          </g>
        </g>
      </g>
      ${variant === "orb" ? orb : wand}
    </svg>`;
  };

  /** Kitty asleep on a crescent moon. */
  K.moon = () => {
    const p = "k" + ++uid;
    return `<svg class="k-svg" viewBox="0 0 140 120" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${p}m" cx=".35" cy=".35"><stop offset="0" stop-color="#fff7d6"/><stop offset="1" stop-color="#e2c97e"/></radialGradient>
        <filter id="${p}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path d="M58 22 A 44 44 0 1 0 118 92 A 36 36 0 1 1 58 22 Z" fill="url(#${p}m)" filter="url(#${p}g)" opacity=".95"/>
      <g class="k-sleeper">
        <path d="M66 64 C 64 50, 78 42, 94 44 C 112 46, 120 58, 116 70 C 104 74, 80 74, 66 64 Z" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6" stroke-width="1.5"/>
        <path d="M70 58 L66 44 L78 52 Z M86 48 L88 36 L94 47 Z" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6" stroke-width="1.2"/>
        <path d="M72 58 q4 3 8 0 M84 55 q4 3 8 0" fill="none" stroke="#e2c97e" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M114 66 C 128 64, 130 50, 120 48" fill="none" stroke="#2a1250" stroke-width="6" stroke-linecap="round"/>
      </g>
      <g class="k-zzz" fill="#c4b5fd" font-family="Cinzel, serif" font-weight="600">
        <text x="98" y="34" font-size="11">z</text><text x="108" y="24" font-size="14">z</text><text x="120" y="12" font-size="17">Z</text>
      </g>
    </svg>`;
  };

  /** Small floating kitty head with glowing eyes. */
  K.floater = () => `<svg class="k-svg" viewBox="0 0 60 52" aria-hidden="true" focusable="false">
      <path d="M8 50 C 1 32, 5 20, 11 15 L 9 1 L 23 11 C 27 10, 33 10, 37 11 L 51 1 L 49 15 C 55 20, 59 32, 52 50 Z" fill="#12002a" stroke="#a78bfa" stroke-opacity=".45" stroke-width="1.5"/>
      <g class="k-blink"><ellipse cx="22" cy="30" rx="4.5" ry="5.5" fill="#e2c97e"/><ellipse cx="38" cy="30" rx="4.5" ry="5.5" fill="#e2c97e"/>
      <ellipse cx="22" cy="30" rx="1.3" ry="4.4" fill="#12002a"/><ellipse cx="38" cy="30" rx="1.3" ry="4.4" fill="#12002a"/></g>
    </svg>`;

  /** Kitty peeking from behind a crystal ball (result card). */
  K.peeker = () => {
    const p = "k" + ++uid;
    return `<svg class="k-svg" viewBox="0 0 90 80" aria-hidden="true" focusable="false">
      <defs><radialGradient id="${p}b" cx=".38" cy=".32"><stop offset="0" stop-color="#f5f0ff"/><stop offset=".4" stop-color="#c4b5fd"/><stop offset="1" stop-color="#5b21b6"/></radialGradient></defs>
      <path d="M20 46 L16 18 L34 32 Z M70 46 L74 18 L56 32 Z" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6" stroke-width="1.2"/>
      <ellipse cx="45" cy="46" rx="28" ry="22" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6" stroke-width="1.2"/>
      <g class="k-blink"><ellipse cx="35" cy="42" rx="4.5" ry="5" fill="#f5e3a3"/><ellipse cx="55" cy="42" rx="4.5" ry="5" fill="#f5e3a3"/>
      <ellipse cx="35" cy="42" rx="1.3" ry="4" fill="#14002a"/><ellipse cx="55" cy="42" rx="1.3" ry="4" fill="#14002a"/></g>
      <circle cx="45" cy="68" r="17" fill="url(#${p}b)" stroke="#ddd6fe" stroke-opacity=".7"/>
      <path d="M37 61 q4 -5 9 -5" stroke="#fff" stroke-opacity=".75" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="27" cy="60" rx="7" ry="5" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6"/><ellipse cx="63" cy="60" rx="7" ry="5" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6"/>
    </svg>`;
  };

  /** Curled-up kitty for empty states. */
  K.curled = () => `<svg class="k-svg k-curled" viewBox="0 0 80 50" aria-hidden="true" focusable="false">
      <path d="M10 42 C 6 24, 24 12, 44 14 C 64 16, 74 30, 70 42 Z" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6" stroke-width="1.5"/>
      <path d="M14 30 L10 14 L24 24 Z M30 18 L32 6 L38 17 Z" fill="#2a1250" stroke="#a78bfa" stroke-opacity=".6" stroke-width="1.2"/>
      <path d="M18 30 q3 2.5 6 0 M28 27 q3 2.5 6 0" fill="none" stroke="#e2c97e" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M68 40 C 78 38, 78 26, 70 24" fill="none" stroke="#2a1250" stroke-width="5" stroke-linecap="round"/>
    </svg>`;

  /** Places all decorative kitties. Clicking a sorcerer spins the wheel. */
  K.mount = () => {
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set("kittyWand", K.sorcerer({ variant: "wand", hat: "#7c3aed" }));
    set("kittyOrb", K.sorcerer({ variant: "orb", hat: "#4c1d95", robe: "#312e81" }));
    set("kittyMoon", K.moon());
    set("kittyPeek", K.peeker());
    const sky = document.getElementById("kittySky");
    if (sky) {
      const spots = [[6, 22, 34, 0], [91, 14, 26, 1.4], [3, 70, 28, 2.6], [94, 58, 36, 0.8], [48, 92, 24, 3.2], [72, 34, 22, 2]];
      sky.innerHTML = spots.map(([x, y, w, d]) =>
        `<div class="k-floater" style="left:${x}%;top:${y}%;width:${w}px;animation-delay:-${d}s;--bd:${(2.5 + d).toFixed(1)}s">${K.floater()}</div>`).join("");
    }
    document.querySelectorAll(".sorcerer").forEach((el) => el.addEventListener("click", () => TO.app && TO.app.spin()));
  };
})(window.TO);
