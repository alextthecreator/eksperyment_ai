import { initJsPsych } from "jspsych";
import HtmlButtonResponsePlugin from "./vendor/@jspsych/plugin-html-button-response/dist/index.js";
import SurveyLikertPlugin from "./vendor/@jspsych/plugin-survey-likert/dist/index.js";
import SurveyMultiChoicePlugin from "./vendor/@jspsych/plugin-survey-multi-choice/dist/index.js";
import { estimateStreamMs, runAiStream, sampleThinkingMs } from "./ai_stream.js";
import { QUESTIONS } from "./questions_data.js";
import { submitResultsCsv } from "./results_submit.js";
import { fetchAssignedGroup } from "./assignment.js";

const CHOICES = ["A", "B", "C", "D"];

/** In CSV for the no-AI condition — use text instead of 0/1 or blank to avoid confusion with “N/A” in analysis. */
const AI_METRIC_NA = "N/A";

const RESPONSE_ENABLE_DELAY_MS = 500;
const TEST_QUESTIONS_LIMIT = 15;
const LIKERT_5_WORD_LABELS = [
  "Zdecydowanie się nie zgadzam",
  "Nie zgadzam się",
  "Nie mam zdania",
  "Zgadzam się",
  "Zdecydowanie się zgadzam",
];
const LIKERT_7_WORD_LABELS = [
  "Zdecydowanie się nie zgadzam",
  "Nie zgadzam się",
  "Raczej się nie zgadzam",
  "Nie mam zdania",
  "Raczej się zgadzam",
  "Zgadzam się",
  "Zdecydowanie się zgadzam",
];
const CONTROL_6_WORD_LABELS = [
  "Brak kontroli",
  "Niemal brak kontroli",
  "Nieco kontroli",
  "Pewna kontrola",
  "Niemal pełna kontrola",
  "Pełna kontrola",
];
const REQUIRED_OPTION_MESSAGE_PL = "Proszę wybrać jedną z opcji.";

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

function installPolishValidationMessages() {
  const clearRadioGroupValidity = function (inputEl) {
    if (!inputEl || inputEl.type !== "radio" || !inputEl.name) return;
    const escapedName =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(inputEl.name)
        : inputEl.name.replace(/"/g, '\\"');
    document
      .querySelectorAll(`input[type="radio"][name="${escapedName}"]`)
      .forEach((radio) => {
        if (typeof radio.setCustomValidity === "function") {
          radio.setCustomValidity("");
        }
      });
  };

  const setPolishMessage = function (event) {
    const el = event && event.target;
    if (!el || typeof el.setCustomValidity !== "function") return;
    if (el.validity && el.validity.valueMissing) {
      el.setCustomValidity(REQUIRED_OPTION_MESSAGE_PL);
    }
  };

  const clearMessage = function (event) {
    const el = event && event.target;
    if (!el || typeof el.setCustomValidity !== "function") return;
    el.setCustomValidity("");
    clearRadioGroupValidity(el);
  };

  document.addEventListener("invalid", setPolishMessage, true);
  document.addEventListener("input", clearMessage, true);
  document.addEventListener("change", clearMessage, true);
}

async function main() {
  installPolishValidationMessages();
  /** Parallel with parsing this module (`boot.js`); does not block initJsPsych. */
  const assignmentPromise =
    typeof window !== "undefined" && window.__experimentAssignmentPromise
      ? window.__experimentAssignmentPromise
      : fetchAssignedGroup();

  const jsPsych = initJsPsych({
    override_safe_mode: true,
    show_progress_bar: true,
    auto_update_progress_bar: true,
    message_progress_bar: "Postęp badania",
    on_trial_start: function () {
      jsPsych.getDisplayElement().innerHTML = "";
    },
    on_finish: function () {
      const csv = jsPsych.data.get().csv();
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
  <p class="survey-lead">Dziękujemy za zainteresowanie udziałem. Poniżej znajdziesz najważniejsze informacje organizacyjne przed rozpoczęciem badania.</p>
  <h2 class="survey-subtitle">Opis badania</h2>
  <div class="survey-prose">
    <p>Badanie polega na udzielaniu odpowiedzi na pytania zamknięte oraz wypełnieniu kilku krótkich kwestionariuszy. W trakcie badania możesz zobaczyć dodatkowe podpowiedzi systemowe. Prosimy o odpowiadanie zgodnie z własną oceną.</p>
    <p>Udział jest dobrowolny i anonimowy. Na każdym etapie możesz zrezygnować z udziału, zamykając okno przeglądarki.</p>
    <p>Szacowany czas udziału: około 10 minut.</p>
  </div>
  <h2 class="survey-subtitle">Instrukcja</h2>
  <div class="survey-prose">
    <p>1. Czytaj uważnie treść każdego ekranu i wybieraj odpowiedzi zgodnie z własnym przekonaniem.</p>
    <p>2. W części testowej zaznacz jedną odpowiedź przy każdym pytaniu.</p>
    <p>3. W części kwestionariuszowej oceniaj stwierdzenia na dostępnych skalach (np. zdecydowanie się nie zgadzam - zdecydowanie się zgadzam) zgodnie z opisem podanym nad pytaniami.</p>
    <p>4. Nie ma limitu czasu na pojedyncze pytanie, ale prosimy o płynną pracę bez dłuższych przerw.</p>
    <p>⁠5. Po zakończeniu badania wyświetli się ekran podsumowania z wynikiem i podziękowanie.</p>
    <p>Dziękujemy za poświęcony czas i rzetelne odpowiedzi.</p>
  </div>
  <h2 class="survey-subtitle">RODO</h2>
  <section class="rodo-placeholder" aria-labelledby="rodo-heading">
    <h2 id="rodo-heading" class="survey-subtitle">Informacja o przetwarzaniu danych</h2>
    <div class="rodo-placeholder-box">
      <p class="rodo-placeholder-lead">Klauzula informacyjna RODO (wersja robocza - do zatwierdzenia formalnego):</p>
      <p class="survey-prose">
        Administratorem danych osobowych jest <span style="color:#b91c1c;font-weight:600;">[nazwa jednostki / instytucji prowadzącej badanie]</span>.
        Dane są przetwarzane w celu realizacji badania naukowego i analizy zbiorczych wyników, na podstawie zgody uczestnika
        (art. 6 ust. 1 lit. a RODO). Zakres przetwarzanych danych obejmuje odpowiedzi udzielone w badaniu oraz dane techniczne
        niezbędne do jego realizacji. Dane będą przechowywane przez okres niezbędny do opracowania wyników badania lub do czasu
        wycofania zgody, jeśli ma to zastosowanie. Uczestnikowi przysługuje prawo dostępu do danych, ich sprostowania, ograniczenia
        przetwarzania, usunięcia oraz wycofania zgody. W sprawach związanych z przetwarzaniem danych można skontaktować się pod adresem:
        <span style="color:#b91c1c;font-weight:600;">[adres e-mail kontaktowy]</span>.
      </p>
    </div>
  </section>
</div>`,
    choices: ["Wyrażam zgodę i przechodzę dalej"],
    button_layout: "grid",
    grid_columns: 1,
    data: { phase: "study_intro_instruction_gdpr" },
  });

  /** 1) Second page: 5 agency items + 2 technology items (Likert layout). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `<div class="survey-block survey-block--demo">

</div>`,
    questions: [
      {
        prompt:
          "1) Placeholder dla pytania o sprawczość",
        name: "agency_01",
        labels: LIKERT_5_WORD_LABELS,
        required: true,
      },
      {
        prompt:
          "2) Placeholder dla pytania o sprawczość",
        name: "agency_02",
        labels: LIKERT_5_WORD_LABELS,
        required: true,
      },
      {
        prompt:
          "3) Placeholder dla pytania o sprawczość",
        name: "agency_03",
        labels: LIKERT_5_WORD_LABELS,
        required: true,
      },
      {
        prompt:
          "4) Placeholder dla pytania o sprawczość",
        name: "agency_04",
        labels: LIKERT_5_WORD_LABELS,
        required: true,
      },
      {
        prompt:
          "5) Placeholder dla pytania o sprawczość",
        name: "agency_05",
        labels: LIKERT_5_WORD_LABELS,
        required: true,
      },
    ],
    button_label: "Dalej",
    scale_width: 720,
    data: { phase: "pre_test_agency_technology" },
  });

  const testQuestions = QUESTIONS.slice(0, TEST_QUESTIONS_LIMIT);
  const nTotal = testQuestions.length;

  let correctSoFar = 0;
  let answeredSoFar = 0;

  /** 3) Test questions (20). */
  testQuestions.forEach((q, index) => {
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
      /** Buttons stay disabled; enabled 2s after full content is visible. */
      enable_button_after: null,
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
        const buttons = Array.from(
          document.querySelectorAll("#jspsych-html-button-response-btngroup .jspsych-btn"),
        );
        buttons.forEach((btn) => {
          btn.disabled = true;
          btn.setAttribute("aria-disabled", "true");
        });

        const enableButtons = function () {
          window.setTimeout(function () {
            buttons.forEach((btn) => {
              btn.disabled = false;
              btn.removeAttribute("aria-disabled");
            });
          }, RESPONSE_ENABLE_DELAY_MS);
        };

        if (!showAiStream) {
          enableButtons();
          return;
        }

        const root = document.querySelector(".ai-stream-root");
        runAiStream(root).then(function (ms) {
          streamDurationMs = ms;
          enableButtons();
        }).catch(function () {
          enableButtons();
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

  });

  timeline.push({
    type: SurveyLikertPlugin,

    questions: [
      {
        prompt: "Mam kontrolę nad moim życiem.",
        labels: LIKERT_7_WORD_LABELS,
        name: "greenaway_control_life",
        required: true,
      },
      {
        prompt: "Gdy daję z siebie wszystko życie nabiera sensu.",
        labels: LIKERT_5_WORD_LABELS,
        name: "meaningfulness_01",
        required: true,
      },
      {
        prompt: "Kiedy bardzo się staram, moje życie ma sens.",
        labels: LIKERT_5_WORD_LABELS,
        name: "meaningfulness_02",
        required: true,
      },
      {
        prompt:
          "Kiedy wymagam od siebie więcej czuję, że realizuję swoje ideały.",
        labels: LIKERT_5_WORD_LABELS,
        name: "meaningfulness_03",
        required: true,
      },
      {
        prompt: "Lubię, gdy życie stawia przede mną intelektualne wyzwania.",
        labels: LIKERT_5_WORD_LABELS,
        name: "nfc_01",
        required: true,
      },
      {
        prompt:
          "Nie podejmuję się rozwiązywania złożonych problemów intelektualnych.",
        labels: LIKERT_5_WORD_LABELS,
        name: "nfc_02",
        required: true,
      },
      {
        prompt: "Staram się wybierać zadania, które są mało skomplikowane.",
        labels: LIKERT_5_WORD_LABELS,
        name: "nfc_03",
        required: true,
      },
      {
        prompt:
          "Wolę nauczyć się, jak rozwiązać problem, niż dostać gotowe rozwiązanie.",
        labels: LIKERT_5_WORD_LABELS,
        name: "nfc_04",
        required: true,
      },
      {
        prompt:
          "Wolę zadania, które wymagają ode mnie całkowitej koncentracji, niż te, których rozwiązanie przychodzi mi bez trudu.",
        labels: LIKERT_5_WORD_LABELS,
        name: "nfc_05",
        required: true,
      },
      {
        prompt:
          "W jakim stopniu miałeś/miałaś poczucie kontroli nad zadaniem?",
        labels: CONTROL_6_WORD_LABELS,
        name: "control_over_task",
        required: true,
      },
    ],
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "post_test_questionnaires_plus_control", phase: "post_test_questionnaires" },
  });

  /** 5) Result screen after test (before demographics). */
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: function () {
      return `<div class="trial-page survey-block--demo" role="main">
  <h1 class="survey-title">Wynik</h1>
  <p class="survey-lead">Udzielono odpowiedzi: <strong>${answeredSoFar}</strong> / ${nTotal}</p>
  <p class="survey-lead">Liczba poprawnych odpowiedzi: <strong>${correctSoFar}</strong></p>
</div>`;
    },
    choices: ["Dalej"],
    button_layout: "grid",
    grid_columns: 1,
    data: { phase: "results_screen" },
  });

  /** 6) Demographics at the end. */
  timeline.push({
    type: SurveyMultiChoicePlugin,
    preamble: `<div class="survey-block survey-block--demo">
  <h1 class="survey-title">Demografia</h1>
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

  /** 7) Final screen — explicit submit/finish action. */
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: `<div class="trial-page survey-block--demo" role="main">
  <h1 class="survey-title">Dziękujemy za udział w badaniu</h1>
  <p class="survey-lead">Kliknij przycisk poniżej, aby zakończyć badanie i wysłać odpowiedzi.</p>
</div>`,
    choices: ["Wyślij i zakończ"],
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
