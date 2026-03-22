# AI experiment — jsPsych (browser task)

Online behavioral task built with **[jsPsych 7](https://www.jspsych.org/)** in the browser. Participants see multiple-choice questions with **simulated “AI” suggestions** (content is **predefined** in a spreadsheet, shown with a short “searching / streaming” animation). Responses, reaction times, group assignment, and optional Likert blocks are saved to a **CSV** file downloaded at the end of the session.

---

## Features

- **40 questions** (or any count) loaded from generated `questions_data.js` (exported from Excel).
- **Between-subjects groups** (A→B→C rotation via `/api/next-condition`, random on failure):
  - `with_explanation` — suggested letter + explanation from the spreadsheet.
  - `without_explanation` — suggested letter only.
  - `no_suggestion` — no AI block (question + A–D only).
- **Reaction time (RT)** — jsPsych records time from stimulus onset to button click (`rt`); optional derived fields include stream duration and adjusted RT (see [Data output](#data-output)).
- **Running score** — “correct / answered so far” in the top-right corner.
- **Responsibility Likert** — 1–10 scale after selected question indices (configurable; table below).
- **UI** — stacked answer options, vertical A–D buttons, footer disclaimer about AI errors, staged “searching” → “suggested answer” animation (`ai_stream.js` + `local.css`).

---

## Procedure (screen order)

| Step | Content |
| ---- | -------- |
| 0 | **Consent / intro** — study description + GDPR placeholder (`consent_intro`) |
| 1 | **Demographics** — 4 multiple-choice items: age, gender, technology use, AI tool use |
| 2 | **Trust placeholders** — technology / trust (Likert 1–5), `trust_placeholders.js` |
| 3 | **Delta scale — part 1** — 12 Likert items _before_ the main task (`DELTA_ITEMS_PART1`, `delta_timing: pre_task`) |
| 4 | **Main task** — 40 base questions with optional AI block (20 correct / 20 incorrect suggestions by design); responsibility scales may appear between items (table below) |
| 5 | **Delta scale — part 2** — 12 Likert items _after_ the main task (`DELTA_ITEMS_PART2`, `delta_timing: post_task`) |
| 6 | **End** — thank-you screen |

---

## Tech stack

| Piece | Role |
| ----- | ---- |
| **jsPsych 7** | Experiment engine, timeline, data |
| **ES modules** | `experiment.js` imports plugins and `questions_data.js` |
| **import map** | Resolves bare `jspsych` import for plugins (`index.html`) |
| **npm** | `jspsych`, `@jspsych/plugin-html-button-response`, `@jspsych/plugin-survey-likert`, `@jspsych/plugin-survey-multi-choice` |
| **Python 3 + openpyxl** | Optional: regenerate `questions_data.js` from `.xlsx` (`generate_questions.py`) |

---

## Repository layout

```
(project root)/
├── index.html           # Entry page, CSS + importmap + experiment.js
├── experiment.js        # Timeline, groups, trials, CSV save
├── ai_stream.js         # “Searching” delay + typewriter timing helpers
├── local.css            # Layout, AI panel, buttons, footer
├── questions_data.js    # Exported questions (do not edit by hand — regenerate from Excel)
├── generate_questions.py
├── package.json
├── package-lock.json
└── README.md
```

---

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **Local HTTP server** — required because the app uses ES modules (opening `index.html` as `file://` is unreliable)
- **Python 3** + **openpyxl** only if you regenerate questions from Excel:
  ```bash
  pip install openpyxl
  ```

---

## Quick start (local)

```bash
cd <project-root>
npm install
npm start
```

Then open the URL printed by the static server (e.g. **http://localhost:3000**).

Alternative without `npm start`:

```bash
npx --yes serve -l 3000 .
# or
python3 -m http.server 8080
```

---

## Updating questions from Excel

1. Prepare a spreadsheet with columns (header row):

   | Column | Meaning |
   | ------ | ------- |
   | `Nr` / No. | Question number |
   | `Pytanie` / Question | Stem |
   | `Opcje` / Options | Single line with `A) … B) … C) … D) …` |
   | `KLUCZ` / KEY | Correct letter (`A`–`D`) |
   | `SUGESTIA` / SUGGESTION | Letter shown as “AI” (may differ from key — by design) |
   | Explanation (optional column) | Text for the `with_explanation` group |

2. Run the generator (default path is `~/Downloads/Konfiguracja testu AI z bazą pytań.xlsx`; override with a path argument):

   ```bash
   python3 generate_questions.py
   python3 generate_questions.py "/path/to/your/file.xlsx"
   ```

3. This overwrites **`questions_data.js`**. Commit the updated file if you use Git.

---

## Configuration (`experiment.js`)

### Constants and assignment

| Constant / mechanism | Description |
| -------------------- | ----------- |
| `RESPONSIBILITY_LIKERT_AFTER_QUESTION_INDEX` | **0-based** indices in `QUESTIONS`: after answering that item, the responsibility scale (1–10) is shown. Default: `[3, 8, 13, 18, 23, 31, 38]`. Set `[]` to disable. |
| `ai_group` | Between-subjects conditions: rotational assignment **A→B→C** via `/api/next-condition` + Google Apps Script (`doGet`); on failure or missing URL — random. |

### Responsibility scale — after which base questions (numbered 1–40)?

The scale prompt appears **immediately after** the participant answers the listed question:

| Scale block # | After finishing question # |
| --------------- | -------------------------- |
| 1 | 4 |
| 2 | 9 |
| 3 | 14 |
| 4 | 19 |
| 5 | 24 |
| 6 | 32 |
| 7 | 39 |

**0-based** indices in code (same positions in `QUESTIONS`): `3`, `8`, `13`, `18`, `23`, `31`, `38`.

Participant ID:

- Query string: `?participant=YOUR_ID` (optional)
- Otherwise a random ID from jsPsych

---

## Data output

At the end of the experiment the browser downloads **`wyniki.csv`** via `localSave` (participant’s machine — **not** sent to a server unless you add a backend).

Typical columns include (exact set depends on jsPsych version and plugins):

- **Identifiers:** `participant_id`, `ai_group` (`with_explanation` / `without_explanation` / `no_suggestion`), `assignment_source` (`server_rotacja` / `fallback_random`)
- **Per MC trial:** `question_id`, `correct_key`, `response` (button index), `response_letter`, `correct`, `rt`, `rt_ms_stimulus_to_response`, running totals (`correct_so_far`, `answered_so_far`)
- **AI-related fields (only when `ai_group` ≠ `no_suggestion`):** `ai_suggestion_letter`, `ai_thinking_phase_ms`, `ai_stream_planned_ms`, `ai_stream_duration_ms`, `rt_minus_ai_stream_ms`, `waited_for_full_ai_stream` (1 = response after animation by actual duration), `rt_minus_ai_stream_planned_ms`, `waited_for_full_ai_stream_planned` (by planned duration). **For `no_suggestion`, these are `N/A` (text)** — to avoid confusion with missing responses in analysis. Times in **milliseconds** (`rt`, `*_ms`).
- **Likert trials:** `measure`, `after_question_number`, named responses per plugin (e.g. `responsibility_after_q…`)

For remote data collection you must integrate **JATOS**, **Pavlovia**, a custom server, or another pipeline — the stock build does not upload CSV automatically unless you configure Vercel + Apps Script (see `SETUP_RESULTS.txt`).

---

## Deployment (e.g. Vercel, Netlify)

Static hosts often **do not serve `node_modules`** from the deployed URL (404 on `jspsych.css` / `index.js`). This project runs **`npm run build`** (and **`postinstall`**) to copy jsPsych + plugins into **`vendor/`** (gitignored). `index.html` and `experiment.js` load assets from `./vendor/...`.

1. Push this folder to a Git host.
2. **Install:** `npm ci` (or `npm install` — triggers `postinstall` → `vendor/`).
3. **Build:** `npm run build` (copies `vendor/` again; copies static files to `public/` for Vercel).
4. **Output directory:** `public/` when using `vercel.json` in this repo.

`vercel.json` sets `installCommand` + `buildCommand` so Vercel always produces `vendor/` and `public/` before deploy. `netlify.toml` in the repo is optional (Netlify-oriented).

---

## Research ethics note

The interface **simulates** a live AI. Stimuli are **fixed** in the spreadsheet. If your ethics board requires debriefing or explicit disclosure, add instructions and debrief screens in the timeline and adjust copy accordingly.

---

## Troubleshooting

| Issue | What to try |
| ----- | ----------- |
| Blank page or module errors | Serve over **http(s)**, not `file://`. After `npm install`, check that **`vendor/jspsych/`** exists (run `npm run build` if needed). |
| 404 on `jspsych.css` or `index.js` on Vercel | Ensure **Build Command** runs (`npm run build`) and redeploy. |
| Stacked trials / duplicate text | `on_trial_start` clears `#jspsych-content` (already in `experiment.js`) |
| CSV not downloading | Browser may block multiple downloads; run one participant flow per tab |
| Options not splitting into lines | `Options` cell must match pattern `A) … B) …` with spaces before each `A)`–`D)` marker |

---

## Scripts (`package.json`)

- **`npm start`** — static server on port 3000 (`serve`)

---

## License

ISC (see `package.json`). Third-party libraries (jsPsych, plugins) follow their respective licenses.
