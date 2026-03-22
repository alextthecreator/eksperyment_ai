/**
 * Zwraca kolejny warunek międzyczynnikowy (rotacja A→B→C) z Google Apps Script (doGet).
 * Wymaga APPS_SCRIPT_URL — ten sam URL co wdrożenie skryptu; doGet w append-results.gs.
 */

/** GAS bywa wolny lub „zamarza” — bez limitu funkcja Vercel mogła trzymać odpowiedź wiele sekund. */
const APPS_SCRIPT_FETCH_MS = 2500;

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).setHeader("Allow", "GET").end("Method Not Allowed");
    return;
  }

  const url = process.env.APPS_SCRIPT_URL;
  if (!url || String(url).trim() === "") {
    res.status(200).json({
      group: null,
      fallback: true,
      reason: "no APPS_SCRIPT_URL",
    });
    return;
  }

  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(APPS_SCRIPT_FETCH_MS),
    });
    const text = await r.text();
    if (!r.ok) {
      res.status(200).json({
        group: null,
        fallback: true,
        reason: "apps_script",
        status: r.status,
      });
      return;
    }
    const j = JSON.parse(text);
    res.status(200).json({
      group: j.group || null,
      seq: j.seq,
      fallback: !j.group,
    });
  } catch (e) {
    const msg = String(e.message || e);
    const aborted =
      e && (e.name === "AbortError" || /aborted|timeout/i.test(msg));
    res.status(200).json({
      group: null,
      fallback: true,
      reason: aborted ? "apps_script_timeout" : msg,
    });
  }
};
