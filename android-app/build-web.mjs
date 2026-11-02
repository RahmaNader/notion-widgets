// Builds android-app/www from ../multi-timer for the Android app:
// offline copies of Tailwind CSS, Font Awesome, fonts and SheetJS, plus the native plugin bundle.
// The web widget in ../multi-timer is not modified.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "..", "multi-timer");
const www = join(root, "www");
const nm = join(root, "node_modules");
const SKIP = new Set(["notifier.html", "sw.js", "README.md", join("js", "notifier.js")]); // browser-only notifier

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
cpSync(src, www, {
  recursive: true,
  filter: (p) => !SKIP.has(p.slice(src.length + 1)),
});

// --- vendor files ---
const vendor = join(www, "vendor");
cpSync(join(nm, "@fortawesome/fontawesome-free/css/all.min.css"), join(vendor, "fontawesome/css/all.min.css"));
cpSync(join(nm, "@fortawesome/fontawesome-free/webfonts"), join(vendor, "fontawesome/webfonts"), { recursive: true });
cpSync(join(nm, "xlsx/dist/xlsx.full.min.js"), join(vendor, "xlsx.full.min.js"));
const faces = [];
for (const [pkg, family, weights] of [["inter", "Inter", [200, 300, 400, 500, 600, 700]], ["fredoka", "Fredoka", [500, 600]]]) {
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    cpSync(join(nm, "@fontsource", pkg, "files", file), join(vendor, "fonts", file));
    faces.push(`@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}) format("woff2")}`);
  }
}
writeFileSync(join(vendor, "fonts.css"), faces.join("\n") + "\n");

// --- native plugin bundle ---
await build({
  entryPoints: [join(root, "src/plugins.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: join(www, "js/capacitor-plugins.js"),
  logLevel: "warning",
});

// --- rewrite index.html for offline use ---
const htmlPath = join(www, "index.html");
let html = readFileSync(htmlPath, "utf8");
const swap = (re, to, what) => {
  if (!re.test(html)) throw new Error(`build-web: couldn't find ${what} in multi-timer/index.html`);
  html = html.replace(re, to);
};
swap(/<meta name="viewport" content="[^"]*"\s*\/>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />', "viewport meta");
swap(/\s*<!-- Tailwind CSS \(CDN\) -->\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>\s*tailwind\.config = [\s\S]*?<\/script>/, "", "Tailwind CDN");
swap(/<link\s+href="https:\/\/fonts\.googleapis\.com[^"]*"\s+rel="stylesheet"\s*\/>/, '<link rel="stylesheet" href="vendor/fonts.css" />', "Google Fonts link");
swap(/<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*" \/>/, '<link rel="stylesheet" href="vendor/fontawesome/css/all.min.css" />', "Font Awesome link");
swap(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[^"]*"><\/script>/, '<script src="vendor/xlsx.full.min.js"></script>', "SheetJS script");
swap(/<link rel="stylesheet" href="style\.css" \/>/, '<link rel="stylesheet" href="tailwind.css" />\n    <link rel="stylesheet" href="style.css" />', "style.css link");
swap(/<script src="js\/native\.js"><\/script>/, '<script src="js/capacitor-plugins.js"></script>\n    <script src="js/native.js"></script>', "native.js script");
if (/https?:\/\/(cdn|fonts|cdnjs)\./.test(html)) throw new Error("build-web: index.html still references a CDN");
writeFileSync(htmlPath, html);

// --- Tailwind (compiled after index.html is final so its classes are scanned) ---
const input = join(root, "src/tailwind.css");
if (!existsSync(input)) writeFileSync(input, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
execFileSync(process.execPath, [join(nm, "tailwindcss/lib/cli.js"), "-c", join(root, "tailwind.config.cjs"), "-i", input, "-o", join(www, "tailwind.css"), "--minify"], { cwd: root, stdio: "inherit" });

console.log("build-web: www/ ready");
