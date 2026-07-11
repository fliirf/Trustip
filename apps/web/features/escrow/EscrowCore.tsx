/* Unified escrow artifact — the single visual truth of where the buyer's money
   is. Shared by the public status page and the buyer checkout confirmation.

   The `state` prop is the ONLY input: it must be derived from backend records
   (escrow status / payment status / shipment status), never from a timer, a
   client guess, or an optimistic transition. This component runs no timers that
   change meaning; its animations are ambient loops that merely *express* the
   state it was handed.

   Motion is CSS-only (no GSAP, no smooth-scroll): these are payment routes and
   must stay light. Every animation is transform/opacity/filter only, gated on
   `prefers-reduced-motion`, so CLS stays 0 and reduced-motion users get the
   same static artifact with identical geometry. */

/** Where the artifact is standing. `state` says what the money is doing;
 *  `context` says which machine the reader is looking at it through.
 *
 *  Geometry, material and animation are IDENTICAL across all four. Only the
 *  framing (what surrounds it), the lighting (what falls on it) and the
 *  instrument marks change. The artifact is one object seen from four rooms,
 *  which is the whole reason it stays one component. */
export type EscrowCoreContext =
  /** Buyer checkout. A lock seated in a payment machine: bracket jaws, base plate. */
  | "terminal"
  /** Order status. A beacon under observation: azimuth ring, range rings, sweep. */
  | "radar"
  /** Seller. A seal stamped on a package: crop marks, inspection ticks, matte. */
  | "seal"
  /** No framing. The artifact alone. */
  | "plain";

export type EscrowCoreState =
  /** No funds held yet — payment not confirmed. Dormant, dashed, dim. */
  | "dormant"
  /** Escrow funded on-chain. Locked core, heartbeat, slow orbit. */
  | "funded"
  /** Funded AND the seller has shipped. Locked core + directional flow. */
  | "shipped"
  /** Buyer-confirmed release landed. Open geometry, no heartbeat, at rest. */
  | "completed"
  /** Refunded / cancelled / failed. Dim hairline only. */
  | "voided";

const BONE = "237,234,227";

/** Three ambient particles per ring, placed on the ring radius. */
function OrbitRing({
  r,
  className,
  opacity,
}: {
  r: number;
  className: string;
  opacity: number;
}) {
  return (
    <g className={className}>
      {[0, 120, 240].map((deg) => (
        <circle
          key={deg}
          cx={100 + r}
          cy="100"
          r="1.1"
          fill={`rgba(${BONE},${opacity})`}
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
    </g>
  );
}

/** Bracket jaws and a base plate: the lock is held IN something. Titanium, so
 *  the jaws catch light on their inner faces. */
function TerminalFrame() {
  const jaw = (x: number, y: number, sx: number, sy: number) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
      <path d="M0 12 L0 0 L12 0" fill="none" stroke={`rgba(${BONE},0.34)`} strokeWidth="1.4" />
    </g>
  );
  return (
    <g>
      {jaw(8, 8, 1, 1)}
      {jaw(192, 8, -1, 1)}
      {jaw(8, 192, 1, -1)}
      {jaw(192, 192, -1, -1)}
      {/* Base plate. The machine the lock is bolted to. */}
      <line x1="46" y1="196" x2="154" y2="196" stroke={`rgba(${BONE},0.2)`} strokeWidth="1" />
      <line x1="70" y1="199" x2="130" y2="199" stroke={`rgba(${BONE},0.1)`} strokeWidth="1" />
    </g>
  );
}

/** Azimuth ring, range rings and a sweep. The artifact is being watched, not
 *  operated: nothing here is a control. */
function RadarFrame({ live }: { live: boolean }) {
  return (
    <g>
      <circle cx="100" cy="100" r="94" fill="none" stroke={`rgba(${BONE},0.1)`} strokeWidth="0.6" />
      <circle
        cx="100"
        cy="100"
        r="78"
        fill="none"
        stroke={`rgba(${BONE},0.06)`}
        strokeWidth="0.6"
        strokeDasharray="2 5"
      />
      {/* Azimuth ticks every 30 degrees; the cardinals run longer. */}
      {Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => (
        <line
          key={deg}
          x1="100"
          y1="6"
          x2="100"
          y2={deg % 90 === 0 ? "15" : "11"}
          stroke={`rgba(${BONE},0.22)`}
          strokeWidth="0.8"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
      {/* The sweep only turns while there is something to observe. */}
      {live && (
        <line
          className="radar-sweep"
          x1="100"
          y1="100"
          x2="100"
          y2="8"
          stroke="#FF2D00"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
      )}
    </g>
  );
}

/** Crop marks and inspection ticks. Nothing emits: paper absorbs, and a seal on
 *  a package is read in ordinary light. */
function SealFrame() {
  const stroke = `rgba(${BONE},0.26)`;
  return (
    <g strokeWidth="0.9" stroke={stroke}>
      {/* Crop marks sit OUTSIDE the frame, the way a printer's do. */}
      <line x1="4" y1="20" x2="14" y2="20" />
      <line x1="20" y1="4" x2="20" y2="14" />
      <line x1="186" y1="20" x2="196" y2="20" />
      <line x1="180" y1="4" x2="180" y2="14" />
      <line x1="4" y1="180" x2="14" y2="180" />
      <line x1="20" y1="186" x2="20" y2="196" />
      <line x1="186" y1="180" x2="196" y2="180" />
      <line x1="180" y1="186" x2="180" y2="196" />
      {/* Inspection ticks: someone checked this package and marked the sheet. */}
      {[0, 1, 2].map((i) => (
        <line key={i} x1={86 + i * 10} y1="192" x2={90 + i * 10} y2="186" strokeOpacity="0.5" />
      ))}
    </g>
  );
}

/** The light that falls on the artifact, per room. Metal takes a hard top
 *  light; a beacon is lit by its own emission; paper takes none. */
const CONTEXT_LIGHT: Record<EscrowCoreContext, string | null> = {
  terminal: "radial-gradient(circle at 50% 0%, rgba(237,234,227,0.055), transparent 62%)",
  radar: "radial-gradient(circle at 50% 50%, rgba(255,45,0,0.05), transparent 64%)",
  seal: null,
  plain: null,
};

export function EscrowCore({
  state,
  context = "plain",
  className = "h-56 w-56",
}: {
  state: EscrowCoreState;
  context?: EscrowCoreContext;
  className?: string;
}) {
  const locked = state === "funded" || state === "shipped";
  const completed = state === "completed";
  const voided = state === "voided";
  const light = CONTEXT_LIGHT[context];

  return (
    <div
      aria-hidden
      className={`escrow-enter relative grid place-items-center ${className}`}
    >
      {/* Room light. A static gradient, never animated: this is the lamp, not
          an effect. */}
      {light && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: light }}
        />
      )}
      {/* Settlement glow — static bone, only once released. No celebration. */}
      {completed && (
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(237,234,227,0.10),transparent_62%)]" />
      )}
      {/* Heartbeat ring — the held-funds pulse. Locked states only. */}
      {locked && (
        <span className="absolute inset-6 border border-blood/40 motion-safe:animate-[pulse-ring_3.2s_ease-out_infinite]" />
      )}
      {/* Settled outer ring — solid, at rest. */}
      {completed && <span className="absolute inset-10 border border-bone/25" />}

      <svg
        viewBox="0 0 200 200"
        className={`h-full w-full ${
          completed
            ? "motion-safe:animate-[float-slow_12s_ease-in-out_infinite]"
            : "motion-safe:animate-[float-slow_8s_ease-in-out_infinite]"
        }`}
      >
        {/* Framing. Drawn before the artifact so it reads as the room the
            artifact stands in, never as part of it. The artifact's own geometry
            below is byte-identical across all four contexts. */}
        {context === "terminal" && <TerminalFrame />}
        {context === "radar" && <RadarFrame live={locked} />}
        {context === "seal" && <SealFrame />}

        {/* Outer frame */}
        <rect
          x="20"
          y="20"
          width="160"
          height="160"
          fill="none"
          stroke={`rgba(${BONE},0.14)`}
        />

        {/* Rotated containment diamond. `rotate(45 100 100)` pivots about the
            frame centre, so the rect must already be centred there (x/y =
            100 - size/2) or the diamond swings out of the frame. */}
        <rect
          x="50"
          y="50"
          width="100"
          height="100"
          transform="rotate(45 100 100)"
          fill="none"
          stroke={
            voided
              ? `rgba(${BONE},0.14)`
              : completed
                ? `rgba(${BONE},0.32)`
                : `rgba(${BONE},0.3)`
          }
        />

        {/* Opened-outward echo — geometry only opens once the seal released. */}
        {completed && (
          <rect
            x="60"
            y="60"
            width="80"
            height="80"
            transform="rotate(45 100 100)"
            fill="none"
            stroke={`rgba(${BONE},0.15)`}
          />
        )}

        {/* Orbit layer — slow ambient particles while funds are held. */}
        {locked && (
          <>
            <OrbitRing r={62} className="escrow-orbit" opacity={0.5} />
            <OrbitRing r={48} className="escrow-orbit escrow-orbit-rev" opacity={0.28} />
          </>
        )}

        {/* Journey layer — seller → buyer directional flow. Shipped only:
            the funds stay locked, but the goods are moving. */}
        {state === "shipped" && (
          <g>
            {["", "escrow-journey-2", "escrow-journey-3"].map((delay, i) => (
              <circle
                key={i}
                className={`escrow-journey ${delay}`}
                cx="46"
                cy="100"
                r="1.4"
                fill="#FF2D00"
                fillOpacity="0.85"
              />
            ))}
          </g>
        )}

        {/* Inner mark — the vault itself. Blood while held, bone once settled,
            dashed while dormant. The heartbeat scales the wrapping <g>, never
            the rect: a CSS transform on the rect would override its rotate
            presentation attribute and flatten the diamond. */}
        <g className={locked ? "escrow-heartbeat" : undefined}>
          <rect
            x="70"
            y="70"
            width="60"
            height="60"
            transform="rotate(45 100 100)"
            fill={
              locked
                ? "rgba(255,45,0,0.12)"
                : completed
                  ? `rgba(${BONE},0.05)`
                  : "none"
            }
            stroke={completed ? `rgba(${BONE},0.55)` : "#FF2D00"}
            strokeOpacity={locked ? 0.9 : completed ? 1 : 0.35}
            strokeDasharray={locked || completed ? undefined : "5 5"}
          />
        </g>

        {/* Single restrained blood accent: the seated core. Drawn, not typed —
            as a `◈` character it resolved to a different symbol font on every
            OS, so the one mark the whole product is built around changed
            weight and size depending on who was looking at it. */}
        <g fillOpacity={locked ? 1 : completed ? 0.8 : 0.45}>
          <rect
            x="93"
            y="93"
            width="14"
            height="14"
            transform="rotate(45 100 100)"
            fill="#FF2D00"
          />
          <rect
            x="96.4"
            y="96.4"
            width="7.2"
            height="7.2"
            transform="rotate(45 100 100)"
            fill="#050505"
            fillOpacity="0.55"
          />
        </g>
      </svg>
    </div>
  );
}
