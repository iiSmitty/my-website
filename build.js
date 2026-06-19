/**
 * Build script: minifies the site's hand-written JS and CSS into sibling
 * `*.min.js` / `*.min.css` artifacts that the HTML loads in production.
 *
 * Design notes:
 *  - Per-file minify, NOT bundling. This keeps every top-level function a
 *    global, which the site relies on for inline `onclick="showInfo(...)"`
 *    style handlers in the HTML. Bundling/tree-shaking would rename or drop
 *    them and silently break buttons.
 *  - Source files stay untouched and readable; the `.min.*` outputs are
 *    generated artifacts and are gitignored.
 *  - Only the browser-facing `js/` and `css/` folders are processed. The
 *    Node scripts under `.github/` and `cf-worker/` are never shipped to the
 *    browser, so they are left alone.
 */

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = __dirname;

// Folders to scan, with the loader esbuild should use for them.
const TARGETS = [
  { dir: "js", ext: ".js", loader: "js" },
  { dir: "css", ext: ".css", loader: "css" },
];

/** Collect source files in a folder, skipping already-minified outputs. */
function collectSources(dir, ext) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(ext) && !f.endsWith(`.min${ext}`))
    .map((f) => path.join(abs, f));
}

/** Human-readable size, e.g. 42.5 KB. */
function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Brotli-compressed size — what Cloudflare actually serves over the wire. */
function brotliSize(buf) {
  return zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
}

async function run() {
  const rows = [];

  for (const { dir, ext, loader } of TARGETS) {
    const sources = collectSources(dir, ext);

    for (const srcPath of sources) {
      const code = fs.readFileSync(srcPath, "utf8");

      const result = await esbuild.transform(code, {
        loader,
        minify: true,
        legalComments: "none",
      });

      const outPath = srcPath.replace(new RegExp(`${ext}$`), `.min${ext}`);
      fs.writeFileSync(outPath, result.code);

      const srcBytes = Buffer.byteLength(code);
      const minBuf = Buffer.from(result.code);
      rows.push({
        file: path.relative(ROOT, outPath).replace(/\\/g, "/"),
        raw: srcBytes,
        min: minBuf.length,
        rawBr: brotliSize(Buffer.from(code)),
        minBr: brotliSize(minBuf),
      });
    }
  }

  // ---- Report ----------------------------------------------------------
  rows.sort((a, b) => b.raw - a.raw);

  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);

  console.log("");
  console.log(
    pad("file", 34) +
      padL("raw", 9) +
      padL("min", 9) +
      padL("min+br", 9) +
      padL("vs raw+br", 12)
  );
  console.log("-".repeat(73));

  const totals = { raw: 0, min: 0, rawBr: 0, minBr: 0 };
  for (const r of rows) {
    totals.raw += r.raw;
    totals.min += r.min;
    totals.rawBr += r.rawBr;
    totals.minBr += r.minBr;
    const saved = (((r.rawBr - r.minBr) / r.rawBr) * 100).toFixed(0);
    console.log(
      pad(r.file, 34) +
        padL(kb(r.raw), 9) +
        padL(kb(r.min), 9) +
        padL(kb(r.minBr), 9) +
        padL(`-${saved}%`, 12)
    );
  }

  console.log("-".repeat(73));
  const totalSaved = (
    ((totals.rawBr - totals.minBr) / totals.rawBr) *
    100
  ).toFixed(0);
  console.log(
    pad("TOTAL", 34) +
      padL(kb(totals.raw), 9) +
      padL(kb(totals.min), 9) +
      padL(kb(totals.minBr), 9) +
      padL(`-${totalSaved}%`, 12)
  );
  console.log("");
  console.log(
    `Built ${rows.length} files. "min+br" is what ships over the wire; ` +
      `"vs raw+br" is the extra saving minification adds on top of Brotli.`
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
