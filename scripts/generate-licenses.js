#!/usr/bin/env node
/**
 * Writes docs/open-source-licenses.html: every runtime npm dependency of the
 * app (the transitive closure of package.json "dependencies"), its licence,
 * and the full licence/notice texts (deduplicated), plus the Inter font's
 * SIL Open Font License. Run after changing dependencies:
 *
 *   node scripts/generate-licenses.js
 *
 * Over-inclusive on purpose: build-time tooling pulled in by `expo` is listed
 * too, which is harmless; missing a shipped package is not.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const lock = require(path.join(root, "package-lock.json"));
const pkg = require(path.join(root, "package.json"));
const packages = lock.packages;

// Resolve a dependency the way Node does: nearest node_modules upwards.
function resolveDep(fromKey, name) {
  let base = fromKey;
  for (;;) {
    const candidate = `${base ? `${base}/` : ""}node_modules/${name}`;
    if (packages[candidate]) return candidate;
    if (!base) return null;
    const idx = base.lastIndexOf("/node_modules/");
    base = idx === -1 ? "" : base.slice(0, idx);
  }
}

const seen = new Set();
const queue = Object.keys(pkg.dependencies).map((name) => resolveDep("", name)).filter(Boolean);
while (queue.length) {
  const key = queue.pop();
  if (seen.has(key)) continue;
  seen.add(key);
  const meta = packages[key];
  for (const dep of Object.keys({ ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) })) {
    const resolved = resolveDep(key, dep);
    if (resolved && !seen.has(resolved)) queue.push(resolved);
  }
}

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.|-|$)/i;
const texts = new Map(); // hash -> { text, packages: [] }
const rows = [];
for (const key of [...seen].sort()) {
  const meta = packages[key];
  const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
  const dir = path.join(root, key);
  let licenseText = "";
  try {
    for (const file of fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort()) {
      licenseText += `${fs.readFileSync(path.join(dir, file), "utf8").trim()}\n\n`;
    }
  } catch {
    // Optional platform packages may not be installed locally.
  }
  let hash = null;
  if (licenseText.trim()) {
    hash = crypto.createHash("sha1").update(licenseText.trim()).digest("hex").slice(0, 10);
    if (!texts.has(hash)) texts.set(hash, { packages: [], text: licenseText.trim() });
    texts.get(hash).packages.push(`${name}@${meta.version}`);
  }
  rows.push({ hash, license: meta.license || "See package", name, version: meta.version });
}

const escape = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const interFont = path.join(root, "node_modules/@expo-google-fonts/inter/LICENSE_FONT");
const fontLicense = fs.existsSync(interFont) ? fs.readFileSync(interFont, "utf8").trim() : "";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unibridge - Open-source licences</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 0 auto; padding: 24px 16px 64px; color: #202327; background: #FFF7EA; line-height: 1.5; }
    h1 { color: #0F766E; }
    h2 { margin-top: 32px; }
    a { color: #0B57D0; }
    a:focus-visible { outline: 2px solid #0B57D0; outline-offset: 2px; }
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { border-bottom: 1px solid #E2D8C6; padding: 4px 6px; text-align: left; }
    pre { white-space: pre-wrap; background: #FFFFFF; border: 1px solid #E2D8C6; border-radius: 8px; padding: 12px; font-size: 12px; }
    .muted { color: #596170; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Open-source licences</h1>
  <p>Unibridge is built with the open-source software listed below. We are grateful to its authors.
    This page is generated from the app's dependencies by <code>scripts/generate-licenses.js</code>.</p>
  <p class="muted">Açıq mənbə lisenziyaları · Лицензии открытого ПО</p>

  <h2>Fonts</h2>
  <p><strong>Inter</strong> by Rasmus Andersson, licensed under the SIL Open Font License 1.1.</p>
  ${fontLicense ? `<pre>${escape(fontLicense)}</pre>` : ""}

  <h2>Software packages (${rows.length})</h2>
  <table>
    <thead><tr><th scope="col">Package</th><th scope="col">Version</th><th scope="col">Licence</th></tr></thead>
    <tbody>
${rows
  .map(
    (row) =>
      `      <tr><td>${escape(row.name)}</td><td>${escape(row.version)}</td><td>${
        row.hash ? `<a href="#l-${row.hash}">${escape(row.license)}</a>` : escape(row.license)
      }</td></tr>`,
  )
  .join("\n")}
    </tbody>
  </table>

  <h2>Licence texts</h2>
${[...texts.entries()]
  .map(
    ([hash, entry]) =>
      `  <section id="l-${hash}">\n    <p class="muted">Applies to: ${escape(entry.packages.join(", "))}</p>\n    <pre>${escape(entry.text)}</pre>\n  </section>`,
  )
  .join("\n")}

  <footer class="muted"><p>Unibridge · <a href="privacy-policy.html">Privacy Policy</a> · <a href="terms.html">Terms of Service</a></p></footer>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "docs/open-source-licenses.html"), html);
console.log(`Wrote docs/open-source-licenses.html: ${rows.length} packages, ${texts.size} distinct licence texts.`);
