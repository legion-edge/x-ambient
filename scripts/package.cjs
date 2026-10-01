const fs = require("node:fs");
const path = require("node:path");
const { buildZip } = require("./zip.cjs");
const { LANGUAGES } = require("../src/i18n.js");
const root = path.resolve(__dirname, "..");
const outputRoot = path.resolve(process.env.X_AMBIENT_OUTPUT_DIR || path.join(root, "output"));
const firefox = process.argv.includes("--firefox");
const name = firefox ? "x-ambient-firefox" : "x-ambient";
const destination = path.join(outputRoot, name);
const archive = path.join(outputRoot, `${name}.zip`);
const files = ["manifest.json", "LICENSE", "INSTALL.md", "YOUTUBE.ja.md", "YOUTUBE_FULLSCREEN.ja.md", "YOUTUBE_SHORTS.ja.md", "src/settings.js", "src/i18n.js", "src/streaming.js", "src/instagram.js", "src/youtube.js", "src/x-posts.js", "src/ambient-core.js", "src/card-layout.js", "src/content.js", "src/popup.html", "src/popup.css", "src/popup.js", ...LANGUAGES.map(locale => `_locales/${locale}/messages.json`), ...[16, 32, 48, 128].map(size => `icons/icon-${size}.png`)];
const entries = files.map(name => ({ name, data: fs.readFileSync(path.join(root, name)) }));
if (firefox) {
  const entry = entries.find(entry => entry.name === "manifest.json");
  const manifest = JSON.parse(entry.data);
  manifest.browser_specific_settings = {
    gecko: {
      id: "x-ambient@legion-edge",
      strict_min_version: "142.0",
      data_collection_permissions: { required: ["none"] },
    },
  };
  entry.data = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  entries.push({ name: "FIREFOX.ja.md", data: fs.readFileSync(path.join(root, "FIREFOX.ja.md")) });
}
const zip = buildZip(entries);
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const entry of entries) {
  const target = path.join(destination, entry.name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, entry.data);
}
fs.writeFileSync(archive, zip);
console.log(`Extension folder: ${destination}\nZIP: ${archive}`);
