/**
 * Condition assignment — small module so `boot.js` can fetch in parallel
 * with loading the heavy `experiment.js` graph (e.g. `questions_data.js`).
 */

/** A→B→C rotation via /api/next-condition + Apps Script doGet; on error/timeout, random. */
export async function fetchAssignedGroup() {
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
