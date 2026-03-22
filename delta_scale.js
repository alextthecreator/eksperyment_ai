/**
 * Delta Scale (Drwal, 1979) — locus of control (24 items in the original).
 *
 * Below are **working** items (concise internal/external wording) for testing the procedure.
 * Before production, **replace them with the official wording** from the questionnaire
 * (Drwal, R. Ł., 1979; or current adaptations / publisher permission).
 */

/** Likert labels 1–5 — clickable responses. */
export const DELTA_LIKERT_LABELS = ["1", "2", "3", "4", "5"];

/** Short scale description under the header (both parts). */
export const DELTA_PREAMBLE_COMMON = `
<p class="survey-block-intro"><strong>Skala Delta</strong> — poczucie kontroli (forma robocza).</p>
<p class="survey-hint">Oceń, w jakim stopniu zgadzasz się z każdym stwierdzeniem (1 = zdecydowanie się nie zgadzam, 5 = zdecydowanie się zgadzam).</p>
`;

/** Items 1–12 (part 1). `name` is written to CSV. */
export const DELTA_ITEMS_PART1 = [
  { prompt: "To, co mi się przytrafia, zależy przede wszystkim ode mnie.", name: "delta_01" },
  { prompt: "Często mam wrażenie, że moje plany psują się przez przypadek lub innych ludzi.", name: "delta_02" },
  { prompt: "Gdy czegoś naprawdę chcę, zwykle znajduję sposób, by to osiągnąć.", name: "delta_03" },
  { prompt: "Wiele rzeczy w moim życiu zależy od szczęścia lub zbiegu okoliczności.", name: "delta_04" },
  { prompt: "Moje wybory mają realny wpływ na to, jak układa się moja codzienność.", name: "delta_05" },
  { prompt: "Trudno mi przewidzieć, co mnie spotka — czuję, że dużo zależy od sił zewnętrznych.", name: "delta_06" },
  { prompt: "Jeśli coś mi nie wychodzi, szukam przyczyn w swoim postępowaniu i przygotowaniu.", name: "delta_07" },
  { prompt: "Czuję, że inni lub „los” decydują o moich ważnych sprawach bardziej niż ja.", name: "delta_08" },
  { prompt: "Wierzę, że mogę zmienić swoją sytuację przez systematyczne działanie.", name: "delta_09" },
  { prompt: "Nawet przy wysiłku wyniki często zależą od tego, czego nie jestem w stanie kontrolować.", name: "delta_10" },
  { prompt: "Czuję się sprawcą swoich decyzji w codziennych sprawach.", name: "delta_11" },
  { prompt: "Mam wrażenie, że jestem zależny/a od okoliczności, których nie wybieram.", name: "delta_12" },
];

/** Items 13–24 (part 2). */
export const DELTA_ITEMS_PART2 = [
  { prompt: "Powodzenie w zadaniach, które mnie interesują, zwykle zależy od mojego zaangażowania.", name: "delta_13" },
  { prompt: "Często czuję, że nie mam realnego wpływu na przebieg wydarzeń wokół mnie.", name: "delta_14" },
  { prompt: "Gdy coś planuję, liczę na to, że moje działania przyniosą skutek.", name: "delta_15" },
  { prompt: "Wiele problemów pojawia się niezależnie od tego, jak się przygotuję.", name: "delta_16" },
  { prompt: "Uważam, że mogę uczyć się na błędach i poprawiać swoje wyniki.", name: "delta_17" },
  { prompt: "Mam poczucie, że „i tak nie odemnie zależy”, co się wydarzy.", name: "delta_18" },
  { prompt: "Wierzę, że moja systematyczność przekłada się na efekty.", name: "delta_19" },
  { prompt: "Czuję się bezsilny/a wobec tego, co dzieje się w ważnych dla mnie sprawach.", name: "delta_20" },
  { prompt: "Nawet gdy jest trudno, widzę związek między moim wysiłkiem a wynikiem.", name: "delta_21" },
  { prompt: "Wiele rzeczy przytrafia mi się „z zewnątrz”, niezależnie ode mnie.", name: "delta_22" },
  { prompt: "Czuję, że mogę wpływać na to, jak reaguję na sytuacje, które mnie spotykają.", name: "delta_23" },
  { prompt: "Mam wrażenie, że inni mają większy wpływ na moje życie niż ja sam/a.", name: "delta_24" },
];

export function toLikertQuestions(items) {
  return items.map((row) => ({
    prompt: row.prompt,
    name: row.name,
    labels: DELTA_LIKERT_LABELS,
    required: true,
  }));
}
