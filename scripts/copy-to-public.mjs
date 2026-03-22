/**
 * Vercel (and similar hosts) expect an output folder `public/` after build.
 * Copies static files + vendor/ (after vendor-copy.mjs).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "public");

const staticFiles = [
  "index.html",
  "local.css",
  "questions_data.js",
  "ai_stream.js",
  "delta_scale.js",
  "trust_placeholders.js",
  "results_submit.js",
  "assignment.js",
  "boot.js",
  "experiment.js",
];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
}

rmrf(out);
fs.mkdirSync(out, { recursive: true });

for (const name of staticFiles) {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) {
    console.error("Missing file:", name);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(out, name));
}

const vendorSrc = path.join(root, "vendor");
const vendorDst = path.join(out, "vendor");
if (!fs.existsSync(vendorSrc)) {
  console.error("Missing vendor/ — run: node scripts/vendor-copy.mjs");
  process.exit(1);
}
fs.cpSync(vendorSrc, vendorDst, { recursive: true });

console.log("OK: public/ — ready to deploy.");
