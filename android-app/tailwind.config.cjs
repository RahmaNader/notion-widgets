// Same theme as the Tailwind CDN config in multi-timer/index.html, compiled ahead of time for offline use.
module.exports = {
  darkMode: "class",
  content: ["./www/index.html", "./www/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: "var(--brand-color)",
        brandHover: "var(--brand-hover)",
        brandLight: "var(--brand-light)",
        brandText: "var(--brand-text)",
        darkBg: "#111827",
        darkSurface: "#1f2937",
        darkBorder: "#374151",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Fredoka", "sans-serif"],
      },
    },
  },
};
