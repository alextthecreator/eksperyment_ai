/**
 * Przydział warunku — osobny mały moduł, żeby `boot.js` mógł odpalić fetch
 * równolegle z ładowaniem ciężkiego grafu `experiment.js` (np. questions_data.js).
 */

/** Rotacja A→B→C przez /api/next-condition + Apps Script doGet; przy błędzie / timeoucie losowo. */
export async function fetchAssignedGroup() {
  /** Całość (Vercel cold start + odpowiedź API) — nie trzymaj użytkownika ~5 s jak wcześniej przy race bez abortu. */
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
    /* timeout, brak API, sieć */
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
