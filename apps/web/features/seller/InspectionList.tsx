// The onboarding checklist, as an inspection list: one ruled line per step, one
// stamped verdict. Shared by the dashboard and the links gate so a step can
// never read two different ways on two different pages.
//
// It lives in its own module rather than beside either caller: importing it from
// a page component would pull that page's whole tree into the other's bundle.

"use client";

import { useDict } from "../i18n/LocaleProvider";
import { STEP_KEYS, stepLabel, type StepKey } from "./labels";

export function InspectionList({ done }: { done: Record<StepKey, boolean> }) {
  const d = useDict();
  return (
    <ul>
      {STEP_KEYS.map((key) => {
        const isDone = done[key];
        return (
          <li
            key={key}
            className="desk-row flex items-center justify-between gap-4 py-3"
          >
            <span className={`os-body ${isDone ? "text-bone" : "text-ash"}`}>
              {stepLabel(d, key)}
            </span>
            <span className={`micro-label ${isDone ? "text-blood" : "text-bone/25"}`}>
              {isDone ? d.seller.inspection.done : d.seller.inspection.pending}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
