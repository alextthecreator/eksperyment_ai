/**
 * Simulated “live” AI suggestion — experiment logic unchanged (copy still comes from the spreadsheet).
 * Whole AI block (search + typing) capped at MAX_STREAM_MS.
 * “Searching…” duration is random per trial (up to THINKING_MS_MAX); from SLOW_HINT_AFTER_MS the label
 * switches to the slow message until the searching phase ends (or typing starts).
 */

const MS_PER_CHAR = 26;
/** “Searching…” phase — random length per trial (clamped to fit in MAX_STREAM_MS minus typing budget). */
export const THINKING_MS_MIN = 700;
export const THINKING_MS_MAX = 8000;

const PAUSE_AFTER_SUG_MS = 220;
/** Total AI animation time (start to end of text) — upper cap. */
export const MAX_STREAM_MS = 4000;
/** While still in the searching phase — after this delay from start, swap the label to SLOW_HINT_TEXT. */
export const SLOW_HINT_AFTER_MS = 3000;
/** Shown to participants (Polish UI). */
const SLOW_HINT_TEXT = "Przeszukiwanie zajmuje dłużej niż zazwyczaj…";

const MIN_TOTAL_MS = 1200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** One random value per trial — call once in `experiment.js` and pass to `estimateStreamMs` and `data-thinking-ms`. */
export function sampleThinkingMs() {
  return Math.round(
    THINKING_MS_MIN + Math.random() * (THINKING_MS_MAX - THINKING_MS_MIN),
  );
}

function clampThinkingMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return THINKING_MS_MIN;
  return Math.min(THINKING_MS_MAX, Math.max(THINKING_MS_MIN, Math.round(n)));
}

function estimateTypingMs(suggestion, explanation, withExplanation) {
  const sug = String(suggestion || "");
  const exp = String(explanation || "");
  let t = 0;
  for (let i = 0; i < sug.length; i++) t += MS_PER_CHAR;
  t += PAUSE_AFTER_SUG_MS;
  if (withExplanation && exp.length) {
    for (let j = 0; j < exp.length; j++) t += MS_PER_CHAR;
  }
  return t;
}

/** Actual “searching” phase duration: sampled random length, capped by MAX_STREAM_MS − typing time. */
function computeThinkingDurationMs(sug, exp, withExp, sampledMs) {
  const thinking = clampThinkingMs(sampledMs);
  const typingBudget = estimateTypingMs(sug, exp, withExp);
  const room = MAX_STREAM_MS - typingBudget;
  return Math.max(0, Math.min(thinking, room));
}

/** Estimate for CSV (does not block buttons). */
export function estimateStreamMs(
  suggestion,
  explanation,
  withExplanation,
  showStream = true,
  thinkingMs = THINKING_MS_MIN,
) {
  if (!showStream) return 0;
  const sug = String(suggestion || "");
  const exp = String(explanation || "");
  const typing = estimateTypingMs(sug, exp, withExplanation);
  const think = computeThinkingDurationMs(sug, exp, withExplanation, thinkingMs);
  const raw = think + typing;
  return Math.min(MAX_STREAM_MS, Math.max(MIN_TOTAL_MS, Math.round(raw)));
}

/**
 * Runs the sequence inside `.ai-stream-root`.
 * Answer buttons stay enabled from the start (`enable_button_after: 0` in experiment.js).
 */
export async function runAiStream(rootEl) {
  if (!rootEl) return 0;
  const t0 = performance.now();
  const deadline = t0 + MAX_STREAM_MS;

  const sug = decodeURIComponent(rootEl.dataset.suggestion || "");
  const exp = decodeURIComponent(rootEl.dataset.explanation || "");
  const withExp = rootEl.dataset.withExplanation === "1";
  const sampledThinking = clampThinkingMs(
    parseInt(rootEl.dataset.thinkingMs || "", 10) || THINKING_MS_MIN,
  );
  let thinkingMs = computeThinkingDurationMs(sug, exp, withExp, sampledThinking);

  const thinking = rootEl.querySelector(".ai-thinking");
  const labelEl = rootEl.querySelector(".ai-thinking-label");
  const body = rootEl.querySelector(".ai-body");
  const sugEl = rootEl.querySelector(".tw-sug");
  const expWrap = rootEl.querySelector(".tw-exp");
  const expInner = rootEl.querySelector(".tw-exp-inner");
  const cursorSug = rootEl.querySelector(".tw-cursor-sug");
  const cursorExp = rootEl.querySelector(".tw-cursor-exp");

  let slowTimer = null;
  if (thinking && labelEl && thinkingMs > 0) {
    slowTimer = window.setTimeout(function () {
      const lab = rootEl.querySelector(".ai-thinking-label");
      const pan = rootEl.querySelector(".ai-thinking");
      if (lab && pan && pan.parentNode) {
        lab.textContent = SLOW_HINT_TEXT;
      }
    }, SLOW_HINT_AFTER_MS);
  }

  if (thinking) thinking.hidden = false;
  if (body) body.hidden = true;
  if (expWrap) {
    expWrap.hidden = true;
    if (expInner) expInner.textContent = "";
  }
  if (cursorExp) cursorExp.hidden = true;
  if (sugEl) sugEl.textContent = "";

  /** Sleep clamped to deadline. */
  async function sleepUntil(ms) {
    const left = deadline - performance.now();
    if (left <= 0) return;
    await sleep(Math.min(ms, Math.max(0, left)));
  }

  let usedThinking = 0;
  while (usedThinking < thinkingMs) {
    const step = Math.min(100, thinkingMs - usedThinking);
    await sleepUntil(step);
    usedThinking += step;
    if (performance.now() >= deadline) break;
  }

  if (slowTimer != null) {
    clearTimeout(slowTimer);
    slowTimer = null;
  }

  if (thinking) thinking.remove();
  if (body) {
    body.hidden = false;
    body.classList.add("ai-body--visible");
  }

  async function typeInto(el, text, cursorEl) {
    for (let i = 0; i <= text.length; i++) {
      if (performance.now() >= deadline) {
        if (el) el.textContent = text;
        if (cursorEl) cursorEl.hidden = true;
        return;
      }
      if (!el) return;
      el.textContent = text.slice(0, i);
      if (cursorEl) cursorEl.hidden = i >= text.length;
      if (i < text.length) {
        const left = deadline - performance.now();
        if (left <= 0) {
          el.textContent = text;
          if (cursorEl) cursorEl.hidden = true;
          return;
        }
        await sleep(Math.min(MS_PER_CHAR, left));
      }
    }
  }

  await typeInto(sugEl, sug, cursorSug);
  if (performance.now() < deadline) {
    await sleepUntil(PAUSE_AFTER_SUG_MS);
  }

  if (withExp && exp && expInner && expWrap) {
    expWrap.hidden = false;
    if (cursorExp) cursorExp.hidden = false;
    await typeInto(expInner, exp, cursorExp);
  }

  if (cursorSug) cursorSug.hidden = true;
  if (cursorExp) cursorExp.hidden = true;
  return Math.round(performance.now() - t0);
}
