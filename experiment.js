import { initJsPsych } from "jspsych";
import HtmlButtonResponsePlugin from "./vendor/@jspsych/plugin-html-button-response/dist/index.js";
import SurveyLikertPlugin from "./vendor/@jspsych/plugin-survey-likert/dist/index.js";
import SurveyMultiChoicePlugin from "./vendor/@jspsych/plugin-survey-multi-choice/dist/index.js";
import { estimateStreamMs, runAiStream, sampleThinkingMs } from "./ai_stream.js";
import {
  DELTA_ITEMS_PART1,
  DELTA_ITEMS_PART2,
  DELTA_PREAMBLE_COMMON,
  toLikertQuestions,
} from "./delta_scale.js";
import {
  TRUST_PREAMBLE,
  toTrustLikertQuestions,
} from "./trust_placeholders.js";
import { QUESTIONS } from "./questions_data.js";
import { submitResultsCsv } from "./results_submit.js";
import { fetchAssignedGroup } from "./assignment.js";

const CHOICES = ["A", "B", "C", "D"];

/** In CSV for the no-AI condition — use text instead of 0/1 or blank to avoid confusion with “N/A” in analysis. */
const AI_METRIC_NA = "N/A";

/**
 * After which base questions to show the responsibility scale (1–10).
 * Indices are 0-based (order in `QUESTIONS`); scale appears **after** the answer to that question.
 * Default: after questions **4, 9, 14, 19, 24, 32, 39** (numbered 1–40).
 * Set [] to disable.
 */
const RESPONSIBILITY_LIKERT_AFTER_QUESTION_INDEX = [
  3, 8, 13, 18, 23, 31, 38,
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Split one line of options from Excel (A) … B) …) into separate rows. */
function formatOptionsStacked(optionsText) {
  const raw = String(optionsText || "").trim();
  if (!raw) return "";
  const parts = raw.split(/\s+(?=[A-D]\))/);
  return parts
    .map((line) => `<p class="q-option-line">${escapeHtml(line.trim())}</p>`)
    .join("");
}

async function main() {
  /** Parallel with parsing this module (`boot.js`); does not block initJsPsych. */
  const assignmentPromise =
    typeof window !== "undefined" && window.__experimentAssignmentPromise
      ? window.__experimentAssignmentPromise
      : fetchAssignedGroup();

  const jsPsych = initJsPsych({
    override_safe_mode: true,
    on_trial_start: function () {
      jsPsych.getDisplayElement().innerHTML = "";
    },
    on_finish: function () {
      const csv = jsPsych.data.get().csv();
      jsPsych.data.get().localSave("csv", "wyniki.csv");
      submitResultsCsv(csv);
    },
  });

  const participantId =
    new URLSearchParams(window.location.search).get("participant") ||
    jsPsych.randomization.randomID(8);

  jsPsych.data.addProperties({
    participant_id: participantId,
  });

  const boot = document.getElementById("experiment-boot");
  if (boot) boot.remove();
  /** `#jspsych-content` exists only after `prepareDom()` inside `run()` — do not use `getDisplayElement()` here. */
  const loadingEl = document.createElement("div");
  loadingEl.id = "experiment-loading";
  loadingEl.setAttribute("role", "status");
  loadingEl.setAttribute("aria-live", "polite");
  loadingEl.style.cssText =
    "min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box;font-family:system-ui,sans-serif;font-size:1rem;color:#334155;background:#f8fafc";
  loadingEl.innerHTML = '<p style="margin:0">Ładowanie badania…</p>';
  document.body.appendChild(loadingEl);

  const { group: aiGroup, source: assignmentSource } = await assignmentPromise;
  const withExplanation = aiGroup === "with_explanation";
  const showAiStream = aiGroup !== "no_suggestion";

  jsPsych.data.addProperties({
    ai_group: aiGroup,
    assignment_source: assignmentSource,
  });

  const timeline = [];

  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: `<div class="trial-page survey-block survey-block--intro" role="main">
  <h1 class="survey-title">Badanie online</h1>
  <p class="survey-lead">Dziękujemy za zainteresowanie udziałem. Poniżej znajdziesz krótki opis oraz informacje o danych osobowych. Po zapoznaniu się możesz przejść do kolejnego kroku.</p>
  <h2 class="survey-subtitle">Opis badania</h2>
  <div class="survey-prose">
    <p>W tym zadaniu odpowiesz na pytania wielokrotnego wyboru oraz wypełnisz krótkie kwestionariusze. Czas udziału zależy od tempa odpowiedzi. Twoje wybory są zapisywane w celach naukowych opisanych w dokumentacji badania.</p>
    <p><strong>Uwaga:</strong> treść poniżej ma charakter <em>szablonu</em> — przed zbieraniem danych należy ją zastąpić tekstem zatwierdzonym przez zespół badawczy lub Komisję Bioetyczną.</p>
  </div>
  <section class="rodo-placeholder" aria-labelledby="rodo-heading">
    <h2 id="rodo-heading" class="survey-subtitle">Informacja o przetwarzaniu danych (RODO)</h2>
    <div class="rodo-placeholder-box">
      <p class="rodo-placeholder-lead">[Placeholder — wklej tutaj finalną informację dla uczestnika, np.:]</p>
      <ul class="rodo-placeholder-list">
        <li>Administrator danych: [nazwa jednostki]</li>
        <li>Cel przetwarzania: [np. realizacja badania naukowego]</li>
        <li>Podstawa prawna: [np. art. 6 ust. 1 lit. a RODO — zgoda]</li>
        <li>Okres przechowywania: […]</li>
        <li>Prawa osoby, której dane dotyczą: [skrót lub link do pełnej informacji]</li>
      </ul>
    </div>
  </section>
</div>`,
    choices: ["Zapoznałem/am się i przechodzę dalej"],
    button_layout: "grid",
    grid_columns: 1,
    data: { phase: "consent_intro" },
  });

  timeline.push({
    type: SurveyMultiChoicePlugin,
    preamble: `<div class="survey-block survey-block--demo">
  <h1 class="survey-title">Kilka pytań na początek</h1>
  <p class="survey-lead">Odpowiedzi są anonimowe; wybierz jedną opcję przy każdym pytaniu.</p>
</div>`,
    questions: [
      {
        prompt: "1) Wiek",
        name: "demo_age",
        options: ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
        required: true,
      },
      {
        prompt: "2) Płeć",
        name: "demo_gender",
        options: [
          "Kobieta",
          "Mężczyzna",
          "Niebinarna / inna",
          "Wolę nie podawać",
        ],
        required: true,
      },
      {
        prompt:
          "3) Jak bardzo na co dzień korzystasz z technologii (komputer, smartfon, aplikacje)?",
        name: "demo_tech_use",
        options: [
          "Bardzo mało",
          "Raczej mało",
          "Średnio",
          "Raczej dużo",
          "Bardzo dużo",
        ],
        required: true,
      },
      {
        prompt:
          "4) Jak często korzystasz z narzędzi sztucznej inteligencji (np. czat, tłumacz, generowanie tekstu)?",
        name: "demo_ai_use",
        options: ["Nigdy", "Rzadko", "Czasami", "Często", "Bardzo często"],
        required: true,
      },
    ],
    button_label: "Dalej",
    randomize_question_order: false,
    data: { phase: "demographics" },
  });

  /** 1) Placeholders — technology / trust (Likert). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `${TRUST_PREAMBLE.trim()}`,
    questions: toTrustLikertQuestions(),
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "trust_ai_placeholders", phase: "after_demographics" },
  });

  /** 2) Delta scale — first 12 items (before main task). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `${DELTA_PREAMBLE_COMMON.trim()}<p class="survey-part-label">Pierwsza część Skali Delta (12 pozycji) — przed zadaniem</p>`,
    questions: toLikertQuestions(DELTA_ITEMS_PART1),
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "delta_drwal", delta_part: 1, delta_timing: "pre_task" },
  });

  const nTotal = QUESTIONS.length;

  let correctSoFar = 0;
  let answeredSoFar = 0;

  /** 3) Main questions (40) — short responsibility scales may appear between them. */
  QUESTIONS.forEach((q, index) => {
    const sug = q.suggestion || "";
    const thinkingMs = showAiStream ? sampleThinkingMs() : 0;
    let streamDurationMs = 0;
    const streamMsPlan = estimateStreamMs(
      sug,
      q.explanation || "",
      withExplanation,
      showAiStream,
      thinkingMs,
    );

    const aiBlock = showAiStream
      ? `<div class="ai-stream-root"
  data-suggestion="${encodeURIComponent(sug)}"
  data-explanation="${encodeURIComponent(q.explanation || "")}"
  data-with-explanation="${withExplanation ? "1" : "0"}"
  data-thinking-ms="${thinkingMs}">
  <div class="ai-panel" aria-live="polite">
    <div class="ai-thinking">
      <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
      <span class="ai-thinking-label">Przeszukiwanie dostępnych informacji…</span>
    </div>
    <div class="ai-body" hidden>
      <p class="ai-line"><strong>Sugerowana odpowiedź:</strong> <span class="tw-sug"></span><span class="tw-cursor tw-cursor-sug" aria-hidden="true">▍</span></p>
      <p class="tw-exp" hidden><span class="tw-exp-inner"></span><span class="tw-cursor tw-cursor-exp" hidden aria-hidden="true">▍</span></p>
    </div>
  </div>
</div>`
      : "";

    const stimulus = function () {
      return `<div class="trial-page trial-page--enter" role="main">
  <div class="trial-topbar">
    <p class="trial-progress">Pytanie ${index + 1} z ${nTotal}</p>
    <aside class="score-box" aria-live="polite">
      <span class="score-label">Wynik</span>
      <span class="score-value">${correctSoFar} / ${answeredSoFar}</span>
      <span class="score-sub">poprawne / udzielone</span>
    </aside>
  </div>
  <p class="q-text reveal-in">${escapeHtml(q.text)}</p>
  <div class="q-options-stack reveal-in reveal-in--delay">${formatOptionsStacked(q.options)}</div>
  ${aiBlock}
</div>`;
    };

    timeline.push({
      type: HtmlButtonResponsePlugin,
      stimulus,
      choices: CHOICES,
      button_layout: "grid",
      grid_columns: 1,
      grid_rows: null,
      prompt: showAiStream
        ? `<footer class="trial-footer-disclaimer" role="note">Pamiętaj, sztuczna inteligencja może się mylić.</footer>`
        : "",
      /** Buttons enabled immediately — AI animation does not block the response. */
      enable_button_after: 0,
      data: Object.assign(
        {
          question_id: q.id,
          correct_key: q.key,
          ai_suggestion_letter: showAiStream ? sug : AI_METRIC_NA,
          ai_thinking_phase_ms: showAiStream ? thinkingMs : AI_METRIC_NA,
          ai_stream_planned_ms: showAiStream ? streamMsPlan : AI_METRIC_NA,
        },
        showAiStream
          ? {}
          : {
              ai_stream_duration_ms: AI_METRIC_NA,
              rt_minus_ai_stream_ms: AI_METRIC_NA,
              waited_for_full_ai_stream: AI_METRIC_NA,
              waited_for_full_ai_stream_planned: AI_METRIC_NA,
              rt_minus_ai_stream_planned_ms: AI_METRIC_NA,
            },
      ),
      on_load: function () {
        if (!showAiStream) return;
        const root = document.querySelector(".ai-stream-root");
        runAiStream(root).then(function (ms) {
          streamDurationMs = ms;
        });
      },
      on_finish: function (data) {
        const letter =
          data.response !== null && data.response !== undefined
            ? CHOICES[data.response]
            : null;
        data.response_letter = letter;
        data.correct = letter === q.key;
        answeredSoFar += 1;
        if (data.correct) correctSoFar += 1;
        data.correct_so_far = correctSoFar;
        data.answered_so_far = answeredSoFar;
        data.rt_ms_stimulus_to_response = data.rt;
        if (showAiStream) {
          data.ai_stream_duration_ms = streamDurationMs;
          if (data.rt != null && streamDurationMs > 0) {
            data.rt_minus_ai_stream_ms = data.rt - streamDurationMs;
            data.waited_for_full_ai_stream =
              data.rt >= streamDurationMs ? 1 : 0;
          }
          if (data.rt != null && streamMsPlan > 0) {
            data.rt_minus_ai_stream_planned_ms = data.rt - streamMsPlan;
            data.waited_for_full_ai_stream_planned =
              data.rt >= streamMsPlan ? 1 : 0;
          }
        } else {
          data.ai_stream_duration_ms = AI_METRIC_NA;
          data.rt_minus_ai_stream_ms = AI_METRIC_NA;
          data.waited_for_full_ai_stream = AI_METRIC_NA;
          data.waited_for_full_ai_stream_planned = AI_METRIC_NA;
          data.rt_minus_ai_stream_planned_ms = AI_METRIC_NA;
        }
      },
    });

    if (RESPONSIBILITY_LIKERT_AFTER_QUESTION_INDEX.includes(index)) {
      const afterN = index + 1;
      timeline.push({
        type: SurveyLikertPlugin,
        preamble: `<p class="likert-preamble">Krótka refleksja przed kolejnymi pytaniami.</p>`,
        questions: [
          {
            prompt:
              "Na ile czujesz się odpowiedzialny/a za swoje odpowiedzi w tej części zadania?",
            labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            name: `responsibility_after_q${afterN}`,
            required: true,
          },
        ],
        button_label: "Dalej",
        data: {
          measure: "responsibility_likert",
          after_question_number: afterN,
        },
      });
    }
  });

  /** 4) Delta scale — second 12 items (after main task). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `${DELTA_PREAMBLE_COMMON.trim()}<p class="survey-part-label">Druga część Skali Delta (12 pozycji) — po zadaniu</p>`,
    questions: toLikertQuestions(DELTA_ITEMS_PART2),
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "delta_drwal", delta_part: 2, delta_timing: "post_task" },
  });

  /** 5) Thank-you / debrief. */
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: `<div class="trial-page survey-block--demo" role="main">
  <h1 class="survey-title">Dziękujemy za udział w badaniu</h1>
  <p class="survey-lead">Możesz zamknąć tę kartę przeglądarki. Jeśli pobrałeś/aś plik z wynikami, przekaż go zgodnie z instrukcją badacza.</p>
</div>`,
    choices: ["Zakończ"],
    button_layout: "grid",
    grid_columns: 1,
    data: { phase: "debrief_thanks" },
  });

  const loading = document.getElementById("experiment-loading");
  if (loading) loading.remove();
  jsPsych.run(timeline);
}

main().catch(function (err) {
  console.error(err);
  const boot = document.getElementById("experiment-boot");
  if (boot) boot.remove();
  const loading = document.getElementById("experiment-loading");
  if (loading) loading.remove();
  document.body.innerHTML =
    "<p style=\"padding:2rem;font-family:system-ui\">Nie udało się uruchomić badania. Odśwież stronę.</p>";
});
