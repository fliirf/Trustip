// The onboarding checklist, as an inspection list: one ruled line per step, one
// stamped verdict. Shared by the dashboard and the links gate so a step can
// never read two different ways on two different pages.
//
// It lives in its own module rather than beside either caller: importing it from
// a page component would pull that page's whole tree into the other's bundle.

import { STEP_LABELS } from "./labels";

export type StepKey = (typeof STEP_LABELS)[number]["key"];

export function InspectionList({ done }: { done: Record<StepKey, boolean> }) {
  return (
    <ul>
      {STEP_LABELS.map((step) => {
        const isDone = done[step.key];
        return (
          <li
            key={step.key}
            className="desk-row flex items-center justify-between gap-4 py-3"
          >
            <span className={`os-body ${isDone ? "text-bone" : "text-ash"}`}>
              {step.label}
            </span>
            <span className={`micro-label ${isDone ? "text-blood" : "text-bone/25"}`}>
              {isDone ? "Selesai" : "Belum"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
