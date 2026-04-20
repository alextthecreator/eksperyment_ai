/**
 * Condition assignment — small module so `boot.js` can fetch in parallel
 * with loading the heavy `experiment.js` graph (e.g. `questions_data.js`).
 */

/**
 * Test-only forced assignment using opaque URL codes.
 * Keep these links private inside the research team.
 */
const FORCED_ASSIGNMENT_KEY_PARAM = "k";
const FORCED_ASSIGNMENT_CODE_PARAM = "v";
const FORCED_ASSIGNMENT_KEY = "q7n4";
const FORCED_ASSIGNMENT_CODES = {
  a3: "with_explanation",
  b7: "without_explanation",
  c2: "no_suggestion",
};

function readForcedGroupFromUrl() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const key = url.searchParams.get(FORCED_ASSIGNMENT_KEY_PARAM);
  const code = url.searchParams.get(FORCED_ASSIGNMENT_CODE_PARAM);
  if (key !== FORCED_ASSIGNMENT_KEY) return null;
  const group = FORCED_ASSIGNMENT_CODES[code];
  if (!group) return null;

  // Remove override params from the visible URL immediately.
  url.searchParams.delete(FORCED_ASSIGNMENT_KEY_PARAM);
  url.searchParams.delete(FORCED_ASSIGNMENT_CODE_PARAM);
  const cleaned =
    url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
  window.history.replaceState({}, "", cleaned);
  return group;
}

/** A→B→C rotation via /api/next-condition + Apps Script doGet; on error/timeout, random. */
export async function fetchAssignedGroup() {
  const forcedGroup = readForcedGroupFromUrl();
  if (forcedGroup) {
    return { group: forcedGroup, source: "forced_test_link" };
  }

  /** Total time (Vercel cold start + API) — avoid ~5s waits from an un-aborted fetch. */
  const FETCH_TIMEOUT_MS = 4000;
  try {
    const controller = new AbortController();
    const t = setTimeout(function () {
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    try {
      const r = await fetch("/api/next-condition", {
        signal: controller.signal,
      });
      const j = await r.json();
      if (
        j.group &&
        ["with_explanation", "without_explanation", "no_suggestion"].includes(
          j.group,
        )
      ) {
        return {
          group: j.group,
          source: j.fallback ? "fallback_random" : "server_rotacja",
        };
      }
    } finally {
      clearTimeout(t);
    }
  } catch {
    /* timeout, missing API, network */
  }
  const _r = Math.random();
  const group =
    _r < 1 / 3
      ? "with_explanation"
      : _r < 2 / 3
        ? "without_explanation"
        : "no_suggestion";
  return { group, source: "fallback_random" };
}
