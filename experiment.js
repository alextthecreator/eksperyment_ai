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
const SCALE_1_TO_5_LABELS = [
  "1<br>zdecydowanie się nie zgadzam",
  "2",
  "3",
  "4",
  "5<br>zdecydowanie się zgadzam",
];
const SCALE_1_TO_6_LABELS = [
  "1<br>brak kontroli",
  "2",
  "3",
  "4",
  "5",
  "6<br>pełna kontrola",
];
const SCALE_1_TO_7_LABELS = [
  "1<br>zdecydowanie się nie zgadzam",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7<br>zdecydowanie się zgadzam",
];
const TASK_SELF_EFFICACY_SCALE = [
  "[-2]<br>Bardzo nieskuteczny/a",
  "-1",
  "0",
  "1",
  "[2]<br>Bardzo skuteczny/a",
];
const TASK_EFFICIENCY_SCALE = [
  "[-2]<br>Bardzo niesprawny/a",
  "-1",
  "0",
  "1",
  "[2]<br>Bardzo sprawny/a",
];
const TASK_COMPETENCE_SCALE = [
  "[-2]<br>Bardzo niekompetentny/a",
  "-1",
  "0",
  "1",
  "[2]<br>Bardzo kompetentny/a",
];
const AFFECT_1_TO_7_ANCHORED_SCALE = [
  "1<br>wcale",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7<br>ekstremalnie",
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
    <p>Badanie polega na udzielaniu odpowiedzi na pytania zamknięte oraz wypełnieniu kilku krótkich kwestionariuszy. Prosimy o odpowiadanie zgodnie z własną oceną.</p>
    <p>Udział jest dobrowolny i anonimowy. Na każdym etapie możesz zrezygnować z udziału, zamykając okno przeglądarki.</p>
    <p>Szacowany czas udziału: około 10 minut.</p>
    <p>Warunkiem udziału w badaniu jest ukończenie 18. roku życia.</p>
  </div>
  <h2 class="survey-subtitle">Instrukcja</h2>
  <div class="survey-prose">
    <p>1. Czytaj uważnie treść każdego ekranu i wybieraj odpowiedzi zgodnie z własnym przekonaniem.</p>
    <p>2. W części testowej zaznacz jedną odpowiedź przy każdym pytaniu.</p>
    <p>3. W części kwestionariuszowej oceniaj stwierdzenia na dostępnych skalach (np. zdecydowanie się nie zgadzam - zdecydowanie się zgadzam) zgodnie z opisem podanym nad lub pod pytaniami.</p>
    <p>4. Nie ma limitu czasu na pojedyncze pytanie, ale prosimy o płynną pracę bez dłuższych przerw.</p>
    <p>⁠5. Po zakończeniu badania wyświetli się ekran podsumowania z wynikiem i podziękowanie.</p>
    <p>Dziękujemy za poświęcony czas.</p>
  </div>
  <section class="rodo-placeholder" aria-labelledby="rodo-heading">
    <h2 id="rodo-heading" class="survey-subtitle">Informacja o przetwarzaniu danych osobowych</h2>
    <div class="rodo-placeholder-box">
      <p class="survey-prose"><i>
        Administratorem danych osobowych jest Uniwersytet SWPS z siedzibą w Warszawie, ul. Chodakowska 19/31, 03-815 Warszawa.<br><br>
        Dane są przetwarzane w celu realizacji badania naukowego i analizy zbiorczych wyników, na podstawie zgody uczestnika
        (art. 6 ust. 1 lit. a RODO). Zakres przetwarzanych danych obejmuje odpowiedzi udzielone w badaniu oraz dane techniczne
        niezbędne do jego realizacji. Dane będą przechowywane przez okres niezbędny do opracowania wyników badania lub do czasu
        wycofania zgody, jeśli ma to zastosowanie.<br><br>Uczestnikowi przysługuje prawo dostępu do danych, ich sprostowania, ograniczenia
        przetwarzania, usunięcia oraz wycofania zgody. W sprawach związanych z przetwarzaniem danych można skontaktować się pod adresem:
        swps@swps.edu.pl.
      </i></p>
    </div>
  </section>
</div>`,
    choices: ["Potwierdzam ukończenie 18 lat, wyrażam zgodę i przechodzę dalej"],
    button_layout: "grid",
    grid_columns: 1,
    data: { phase: "study_intro_instruction_gdpr" },
  });

  const testQuestions = QUESTIONS.slice(0, TEST_QUESTIONS_LIMIT);
  const nTotal = testQuestions.length;

  let correctSoFar = 0;
  let answeredSoFar = 0;

  /** 2) Test questions. */
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

  /** 3) Poczucie kontroli nad zadaniem (1-6). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `<div class="survey-block survey-block--demo survey-preamble--top survey-layout--single-question">
  <h1 class="survey-title">Na kolejnych stronach znajdują się różne pytania. Prosimy o udzielanie odpowiedzi zgodnie z prawdą. Skala do każdego zestawu pytań jest opisana u góry strony lub bezpośrednio na skali.</h1>
  <p class="survey-lead">(1 - brak kontroli, 2 - niemal brak kontroli, 3 - nieco kontroli, 4 - pewna kontrola, 5 - niemal pełna kontrola, 6 - pełna kontrola)</p>
</div>`,
    questions: [
      {
        prompt: "W jakim stopniu miałeś/miałaś poczucie kontroli nad zadaniem?",
        labels: SCALE_1_TO_6_LABELS,
        name: "control_over_task",
        required: true,
      },
    ],
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "control_over_task", phase: "post_test_control_over_task" },
  });

  /** 4) Samoocena wykonania zadania (-2..2). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `<div class="survey-block survey-block--demo survey-preamble--top">
  <h1 class="survey-title">Prosimy o udzielenie odpowiedzi na poniższe pytania.</h1>
</div>`,
    questions: [
      {
        prompt: "Określ swoje poczucie skuteczności podczas wykonywania zadania.",
        labels: TASK_SELF_EFFICACY_SCALE,
        name: "task_self_efficacy_01",
        required: true,
      },
      {
        prompt:
          "Określ, jak sprawny/a czułeś/aś się podczas wykonywania zadania.",
        labels: TASK_EFFICIENCY_SCALE,
        name: "task_self_efficacy_02",
        required: true,
      },
      {
        prompt:
          "Określ swoje poczucie kompetencji podczas wykonywania zadania.",
        labels: TASK_COMPETENCE_SCALE,
        name: "task_self_efficacy_03",
        required: true,
      },
    ],
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "task_self_efficacy", phase: "post_test_task_self_efficacy" },
  });

  /** 5) Meaningfulness + Need for Cognition (1-5). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `<div class="survey-block survey-block--demo survey-preamble--top">
  <h1 class="survey-title">Prosimy o udzielenie odpowiedzi na poniższe pytania.</h1>
  <p class="survey-lead">(1 - zdecydowanie się nie zgadzam, 2 - nie zgadzam się, 3 - nie mam zdania, 4 - zgadzam się, 5 - zdecydowanie się zgadzam)</p>
</div>`,
    questions: [
      {
        prompt: "Gdy daję z siebie wszystko życie nabiera sensu.",
        labels: SCALE_1_TO_5_LABELS,
        name: "meaningfulness_01",
        required: true,
      },
      {
        prompt: "Kiedy bardzo się staram, moje życie ma sens.",
        labels: SCALE_1_TO_5_LABELS,
        name: "meaningfulness_02",
        required: true,
      },
      {
        prompt:
          "Kiedy wymagam od siebie więcej czuję, że realizuję swoje ideały.",
        labels: SCALE_1_TO_5_LABELS,
        name: "meaningfulness_03",
        required: true,
      },
      {
        prompt: "Lubię, gdy życie stawia przede mną intelektualne wyzwania.",
        labels: SCALE_1_TO_5_LABELS,
        name: "nfc_01",
        required: true,
      },
      {
        prompt:
          "Nie podejmuję się rozwiązywania złożonych problemów intelektualnych.",
        labels: SCALE_1_TO_5_LABELS,
        name: "nfc_02",
        required: true,
      },
      {
        prompt: "Staram się wybierać zadania, które są mało skomplikowane.",
        labels: SCALE_1_TO_5_LABELS,
        name: "nfc_03",
        required: true,
      },
      {
        prompt:
          "Wolę nauczyć się, jak rozwiązać problem, niż dostać gotowe rozwiązanie.",
        labels: SCALE_1_TO_5_LABELS,
        name: "nfc_04",
        required: true,
      },
      {
        prompt:
          "Wolę zadania, które wymagają ode mnie całkowitej koncentracji, niż te, których rozwiązanie przychodzi mi bez trudu.",
        labels: SCALE_1_TO_5_LABELS,
        name: "nfc_05",
        required: true,
      },
    ],
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "meaningfulness_and_nfc", phase: "post_test_meaningfulness_nfc" },
  });

  /** 6) Kontrola nad życiem (1-7). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `<div class="survey-block survey-block--demo survey-preamble--top survey-layout--single-question">
  <h1 class="survey-title">Prosimy o udzielenie odpowiedzi na poniższe pytanie.</h1>
  <p class="survey-lead">(1 - zdecydowanie się nie zgadzam, 2 - nie zgadzam się, 3 - raczej się nie zgadzam, 4 - nie mam zdania, 5 - raczej się zgadzam, 6 - zgadzam się, 7 - zdecydowanie się zgadzam)</p>
</div>`,
    questions: [
      {
        prompt: "Mam kontrolę nad moim życiem.",
        labels: SCALE_1_TO_7_LABELS,
        name: "greenaway_control_life",
        required: true,
      },
    ],
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "greenaway_control_life", phase: "post_test_control_life" },
  });

  /** 7) Result screen after test (before demographics). */
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: function () {
      return `<div class="trial-page survey-block--demo" role="main">
  <h1 class="survey-title">Twój wynik z części testowej</h1>
  <p class="survey-lead">Liczba poprawnych odpowiedzi: <strong>${correctSoFar}</strong> / ${nTotal}</p>
</div>`;
    },
    choices: ["Dalej"],
    button_layout: "grid",
    grid_columns: 1,
    data: { phase: "results_screen" },
  });

  /** 8) Demographics. */
  timeline.push({
    type: SurveyMultiChoicePlugin,
    preamble: `<div class="survey-block survey-block--demo survey-block--demographics">
  <h1 class="survey-title">Prosimy o udzielenie odpowiedzi na poniższe pytania.</h1>
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

  /** 9) Emotions after demographics (1-7). */
  timeline.push({
    type: SurveyLikertPlugin,
    preamble: `<div class="survey-block survey-block--demo survey-preamble--top">
  <h1 class="survey-title">Prosimy o udzielenie odpowiedzi na poniższe pytanie.</h1>
</div>`,
    questions: [
      {
        prompt:
          '<span class="survey-question-intro">Podczas wykonywania poprzedniego zadania czułem/am:</span>',
        labels: [""],
        name: "emotion_intro_prompt",
        required: false,
      },
      {
        prompt: "Niepokój",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_anxiety",
        required: true,
      },
      {
        prompt: "Niezadowolenie z siebie",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_self_dissatisfaction",
        required: true,
      },
      {
        prompt: "Smutek",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_sadness",
        required: true,
      },
      {
        prompt: "Dobrze",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_feeling_good",
        required: true,
      },
      {
        prompt: "Znudzenie",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_boredom",
        required: true,
      },
      {
        prompt: "Brak motywacji",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_lack_of_motivation",
        required: true,
      },
      {
        prompt: "Zdołowanie",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_low_mood",
        required: true,
      },
      {
        prompt: "Zmęczenie",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_fatigue",
        required: true,
      },
      {
        prompt: "Niepewność",
        labels: AFFECT_1_TO_7_ANCHORED_SCALE,
        name: "emotion_uncertainty",
        required: true,
      },
    ],
    button_label: "Dalej",
    scale_width: 720,
    data: { measure: "post_task_emotions", phase: "post_demographics_emotions" },
  });

  /** 10) Final screen — explicit submit/finish action. */
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
