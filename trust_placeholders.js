/**
 * Placeholder items — trust in AI / technology (edit copy before running the study).
 * Same 1–5 scale as the Delta scale.
 */
import { DELTA_LIKERT_LABELS } from "./delta_scale.js";

export const TRUST_PREAMBLE = `
<p class="survey-block-intro"><strong>Pytania uzupełniające</strong> (zaufanie, technologie)</p>
<p class="survey-hint">Oceń każde stwierdzenie (1 = zdecydowanie się nie zgadzam, 5 = zdecydowanie się zgadzam).</p>
`;

export const TRUST_ITEMS = [
  {
    prompt:
      "[Placeholder] Na ile ufasz odpowiedziom generowanym przez narzędzia sztucznej inteligencji w kontekście zadań podobnych do tego eksperymentu?",
    name: "trust_ai_tools_placeholder",
  },
  {
    prompt:
      "[Placeholder] Na ile czujesz, że rozumiesz, jak działają systemy rekomendujące odpowiedzi (np. czaty AI)?",
    name: "trust_understand_ai_placeholder",
  },
  {
    prompt:
      "[Placeholder] Jak bardzo czujesz się komfortowo, korzystając z nowych technologii w codziennej pracy lub nauce?",
    name: "trust_comfort_tech_placeholder",
  },
];

export function toTrustLikertQuestions() {
  return TRUST_ITEMS.map((row) => ({
    prompt: row.prompt,
    name: row.name,
    labels: DELTA_LIKERT_LABELS,
    required: true,
  }));
}
