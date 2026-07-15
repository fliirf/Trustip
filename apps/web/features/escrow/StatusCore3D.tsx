/* StatusCore3D — the vault, in three dimensions.
 *
 * A CSS-3D artifact (perspective + preserve-3d, NO three.js: these are payment
 * routes and must stay light) built from four nested objects:
 *
 *   ring    a tilted orbit ring circling the vault — lit only while the
 *           protocol is actively holding or moving money
 *   cube    the outer vault: hairline faces with a faint top-light sheen
 *   inner   a second wireframe cube rotated 45° — the brand's diamond-in-
 *           square motif, counter-rotating for depth
 *   kernel  the seated blood core as a small SOLID cube, so it reads from
 *           every angle (a flat mark vanishes edge-on mid-rotation)
 *
 * One distinct, smooth, centred animation per order state; the `state` prop is
 * the ONLY input and must be derived from backend records, exactly like
 * EscrowCore. Every animation is transform/opacity only and collapses to a
 * static tilted artifact under `prefers-reduced-motion`.
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

function Faces({ prefix }: { prefix: string }) {
  return (
    <>
      {FACES.map((f) => (
        <span key={f} className={`${prefix} ${prefix}-${f}`} />
      ))}
    </>
  );
}

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
        {/* Floor glow — the artifact's own light falling below it. */}
        <span className="core3d-glow" />
        <div className="core3d-stage">
          {/* Orbit ring, held in its own tilted plane. */}
          <span className="core3d-ring-plane">
            <span className="core3d-ring" />
          </span>
          <div className="core3d-cube">
            <Faces prefix="core3d-face" />
            {/* Diamond-in-square: the inner wireframe, counter-rotating. */}
            <div className="core3d-inner">
              <Faces prefix="core3d-iface" />
            </div>
            {/* The seated core — a solid volumetric kernel. */}
            <div className="core3d-kernel">
              <Faces prefix="core3d-kface" />
            </div>
          </div>
        </div>
      </div>
      {label && <div className="micro-label mt-4 text-ash">{label}</div>}
    </div>
  );
}
