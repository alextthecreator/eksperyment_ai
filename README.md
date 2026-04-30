# AI Experiment — jsPsych (Browser Task)

Behavioral web experiment built with **[jsPsych 7](https://www.jspsych.org/)**.
Participants complete a fixed sequence of intro, test questions, post-test questionnaires, result screen, demographics, affect items, and a final submit screen with inline debriefing.

AI assistance is simulated from predefined content in `questions_data.js` and shown with a short animated "searching + typing" flow.

---

## Current Status (Up to Date)

This README reflects the latest implementation, including:

- updated screen flow and questionnaire structure,
- progress bar at the top of the screen,
- Polish validation message for missing answers,
- no local CSV auto-download at the end,
- mobile-focused styling updates,
- AI timing changes (`max 4s`, slow-search hint after `3s`),
- post-test questionnaires split into separate pages with anchored scale endpoints (labels and numbers),
- inline debriefing text shown under the submit button right after clicking `Wyślij i zakończ`.

---

## Features

- **15 test questions** shown from `questions_data.js` (`TEST_QUESTIONS_LIMIT`).
- **3 experimental groups** from assignment API:
  - `with_explanation`
  - `without_explanation`
  - `no_suggestion`
- **AI hint animation** with capped timing:
  - `MAX_STREAM_MS = 4000`
  - `SLOW_HINT_AFTER_MS = 3000`
- **Response gating** in test questions:
  - answer buttons unlock after a short delay after full content render.
- **Top progress bar** across the full timeline.
- **Polish required-field validation**:
  - "Proszę wybrać jedną z opcji."
- **Mobile-friendly layout** for long Likert labels and small screens.

---

## Procedure (Screen Order)

| Step | Content                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | Intro screen: welcome + study description + instruction + GDPR text + 18+ participation condition                  |
| 2    | Test block: multiple-choice questions with optional simulated AI support                                           |
| 3    | Post-test page: control over task (1-6 scale, numeric labels)                                                     |
| 4    | Post-test page: task self-efficacy / skill / competence (separate -2 to 2 anchors per item)                       |
| 5    | Post-test page: meaningfulness + need for cognition (1-5 scale, numeric labels)                                   |
| 6    | Post-test page: control over life (1-7 scale, numeric labels)                                                     |
| 7    | Result summary screen                                                                                              |
| 8    | Demographics                                                                                                       |
| 9    | Emotions after task (1-7 scale with anchored ends: `1/wcale`, `7/ekstremalnie`)                                  |
| 10   | Submit screen (`Wyślij i zakończ`) that triggers data upload and reveals inline debriefing under the button      |

---

## Project Structure

```text
(project root)/
├── index.html
├── experiment.js
├── ai_stream.js
├── local.css
├── questions_data.js
├── generate_questions.py
├── scripts/vendor-copy.mjs
├── package.json
└── README.md
```

---

## Prerequisites

- Node.js (LTS recommended)
- npm
- Local HTTP server (required for ES modules)
- Python 3 + `openpyxl` (only if regenerating `questions_data.js`)

```bash
pip install openpyxl
```

---

## Local Run

```bash
cd <project-root>
npm install
npm start
```

Then open the printed local URL (usually `http://localhost:3000`).

Alternative:

```bash
npx --yes serve -l 3000 .
# or
python3 -m http.server 8080
```

---

## Updating Test Questions from Excel

1. Prepare spreadsheet columns:
   - `Nr` / `No.`
   - `Pytanie` / `Question`
   - `Opcje` / `Options` (`A) ... B) ... C) ... D) ...`)
   - `KLUCZ` / `KEY`
   - `SUGESTIA` / `SUGGESTION`
   - optional explanation column
2. Generate:

```bash
python3 generate_questions.py
# or with custom file
python3 generate_questions.py "/path/to/file.xlsx"
```

3. Commit updated `questions_data.js` if needed.

---

## Data Output

- Runtime data is collected through jsPsych internal store and passed to `submitResultsCsv(csv)`.
- **Local file download is disabled** (no `localSave("csv", ...)` call).
- Dataset includes trial-level fields such as:
  - participant and group metadata,
  - response correctness and RT,
  - AI timing and wait metrics (or `N/A` in `no_suggestion` group),
  - questionnaire responses by item name.

---

## Deployment Notes

Build copies jsPsych assets/plugins into `vendor/` and static output to `public/`.

```bash
npm run build
```

For Vercel, use `public/` as output (already handled by current `vercel.json` setup).

---

## Scripts

- `npm start` — run local static server (`serve`, port 3000)
- `npm run build` — copy vendor assets and prepare `public/`

---

## Test-Only Forced Variant Links

Production supports private test links with opaque codes.
After page load, override params are removed from the browser URL bar.

Base pattern:

`https://<your-production-url>/?k=q7n4&v=<code>`

Codes:

- `a3` -> `with_explanation`
- `b7` -> `without_explanation`
- `c2` -> `no_suggestion`

Optional safe testing flag:

- add `&nosubmit=1` to skip result upload.

---

## Troubleshooting

| Problem                     | Check                                                                     |
| --------------------------- | ------------------------------------------------------------------------- |
| Blank page / module errors  | Use `http://` (not `file://`), then run `npm install` and `npm run build` |
| Missing vendor assets       | Confirm `vendor/jspsych/` exists after install/build                      |
| Layout issues on mobile     | Hard refresh and verify latest `local.css` is loaded                      |
| Validation blocks next step | Ensure one option is selected in each required item                       |

---

## License

ISC (see `package.json`). Third-party packages follow their own licenses.
