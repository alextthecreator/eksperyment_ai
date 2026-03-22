import { fetchAssignedGroup } from "./assignment.js";

/** Start condition fetch before the heavy `experiment.js` graph loads. */
if (typeof window !== "undefined") {
  window.__experimentAssignmentPromise = fetchAssignedGroup();
}
