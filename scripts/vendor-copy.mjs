/**
 * Copy jsPsych + plugins into vendor/ — many hosts do not serve node_modules
 * from the deploy root; locally this runs after npm install (postinstall).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
}

const vendor = path.join(root, "vendor");
rmrf(vendor);
fs.mkdirSync(vendor, { recursive: true });

const dirs = [
  ["node_modules/jspsych/css", "vendor/jspsych/css"],
  ["node_modules/jspsych/dist", "vendor/jspsych/dist"],
  [
    "node_modules/@jspsych/plugin-html-button-response/dist",
    "vendor/@jspsych/plugin-html-button-response/dist",
  ],
  [
    "node_modules/@jspsych/plugin-survey-likert/dist",
    "vendor/@jspsych/plugin-survey-likert/dist",
  ],
  [
    "node_modules/@jspsych/plugin-survey-multi-choice/dist",
    "vendor/@jspsych/plugin-survey-multi-choice/dist",
  ],
];

for (const [fromRel, toRel] of dirs) {
  const from = path.join(root, fromRel);
  const to = path.join(root, toRel);
  if (!fs.existsSync(from)) {
    console.error("Missing path (run npm install first):", fromRel);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

console.log("OK: vendor/ — jsPsych + plugins copied.");
