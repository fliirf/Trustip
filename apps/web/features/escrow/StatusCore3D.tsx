/* StatusCore3D — the vault, in three dimensions.
 *
 * A CSS-3D wireframe cube (perspective + preserve-3d, NO three.js: these are
 * payment routes and must stay light) holding the blood core at its centre.
 * One distinct, smooth, centred animation per order state; the `state` prop is
 * the ONLY input and must be derived from backend records, exactly like
 * EscrowCore. Every animation is transform/opacity only and collapses to a
 * static tilted cube under `prefers-reduced-motion`.
 *
 *   awaiting    dashed, dim, hesitant half-turn scan — nothing is held yet
 *   protected   steady confident spin, heartbeat core — funds locked
 *   shipped     the same locked spin, leaning into a gentle travel drift
 *   arriving    slow, near-still rotation, bright core — waiting for the hand
 *   settled     faces opened outward, bone, barely turning — at rest
 *   frozen      rotation halted mid-turn, blood edges breathing — under review
 *   returned    slow REVERSE turn, dim core — the money went back
 *   void        static, ash, no core light — nothing to protect
 */

export type StatusCore3DState =
  | "awaiting"
  | "protected"
  | "shipped"
  | "arriving"
  | "settled"
  | "frozen"
  | "returned"
  | "void";

const FACES = ["front", "back", "left", "right", "top", "bottom"] as const;

export function StatusCore3D({
  state,
  className = "h-40 w-40",
  label,
}: {
  state: StatusCore3DState;
  className?: string;
  /** Optional micro-label rendered under the artifact (already localized). */
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div aria-hidden className={`core3d core3d-${state} ${className}`}>
        <div className="core3d-stage">
          <div className="core3d-cube">
            {FACES.map((f) => (
              <span key={f} className={`core3d-face core3d-face-${f}`} />
            ))}
            <span className="core3d-core" />
          </div>
        </div>
      </div>
      {label && <div className="micro-label mt-4 text-ash">{label}</div>}
    </div>
  );
}
