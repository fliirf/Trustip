/* The world. Server component: this is the entire environment the seven chapters
   are filmed inside, and it is rendered exactly once, at the page root. Nothing
   below ever unmounts, so no chapter can restart the atmosphere it inherits.

   Layers, back to front:

     1. ambient wash    the room's base illumination
     2. three lights    cold / blood / technical. Only their OPACITY is animated,
                        never their colour or geometry, so the lighting timeline
                        is a compositor job rather than a full-screen repaint.
     3. protocol grid   the coordinate system (rotates, drifts, zooms)
     4. dust, far       tiny, dim, slow
     5. Escrow Core     (mounted by CameraRig, not here)
     6. dust, near      larger, brighter, faster
     7. telemetry       environmental storytelling, not UI
     8. grain           film stock

   The lights are separate elements rather than one element whose colour is
   tweened: interpolating `color` on a full-viewport gradient repaints it on
   every scrub frame, whereas cross-fading three static gradients is pure
   compositing. */

/* Deterministic scatter: a fixed LCG, evaluated at module scope. No Math.random,
   so the server and the client agree and hydration stays quiet. */
function scatter(count: number, seed: number, rMin: number, rMax: number) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    cx: +(next() * 100).toFixed(2),
    cy: +(next() * 100).toFixed(2),
    r: +(rMin + next() * (rMax - rMin)).toFixed(3),
    o: +(0.15 + next() * 0.5).toFixed(2),
  }));
}

const DUST_FAR = scatter(34, 20260710, 0.06, 0.16);
const DUST_NEAR = scatter(16, 987654321, 0.12, 0.26);

const BONE = "237,234,227";

function DustField({ points, className }: { points: ReturnType<typeof scatter>; className: string }) {
  return (
    <div className={className} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="dust-spin h-full w-full">
        {points.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={`rgba(${BONE},${p.o})`} />
        ))}
      </svg>
    </div>
  );
}

/* Real values, not invented precision: the network and asset Trustip actually
   settles on, and the ledger the first buyer-signed release landed in. Sized and
   dimmed so it reads as instrumentation bleed, never as something to be read. */
const TELEMETRY_RIGHT = ["NETWORK STELLAR", "ASSET USDC", "ESCROW SOROBAN"] as const;
const TELEMETRY_LEFT = ["LEDGER 3499462", "STATE FUNDED"] as const;

export function WorldLayers() {
  return (
    <>
      <div className="landing-ambient" aria-hidden />

      <div className="landing-light light-cold" aria-hidden />
      <div className="landing-light light-blood" aria-hidden />
      <div className="landing-light light-technical" aria-hidden />

      <div className="landing-grid" aria-hidden />

      <DustField points={DUST_FAR} className="landing-dust landing-dust-far" />
      <DustField points={DUST_NEAR} className="landing-dust landing-dust-near" />

      {/* Two rails, on their sides, hard against the viewport edges — the only
          strip of the page no chapter's copy ever reaches. Shown from 2xl up,
          where the 1400px container leaves ≥36px of clearance either side. */}
      <div className="landing-telemetry hidden 2xl:block" aria-hidden>
        <div className="telemetry-rail telemetry-rail-right">
          {TELEMETRY_RIGHT.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div className="telemetry-rail telemetry-rail-left">
          {TELEMETRY_LEFT.map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span className="telemetry-pulse" />
        </div>
      </div>
    </>
  );
}
