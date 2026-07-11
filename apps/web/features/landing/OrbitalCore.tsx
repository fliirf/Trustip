/* Server component — the hero's protected-core artifact, ported from the
   prototype's OrbitalCore but animated purely with CSS (motion-safe classes).
   Every SVG length attribute is a literal: nothing can render "undefined".

   MATERIALS (see the material system in globals.css)

     rings          titanium. Stroked with a gradient in USER SPACE, not object
                    space, so the specular band stays fixed in the world while
                    the rings rotate through it. That is the whole difference
                    between a metal ring turning and a coloured ring turning.
     shell          ceramic. A matte body tint under the rings, no specular term.
     interior       blood energy. Emissive, so it has no highlight of its own —
                    it is the thing lighting everything else.
     inner rim      the emissive edge, where the shell meets the interior.
     serial + marks laser engraved. Only legible when the Core is at hero scale,
                    which is the only chapter that gives the reader time to look.

   No filters: the rig scales this element on every scrub frame, and an
   feGaussianBlur would force a re-raster each time. Bloom is a radial gradient. */

const BONE = "237,234,227";
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

/* `so` is stroke-opacity: the titanium gradient carries its own alpha ramp, so
   each ring modulates that ramp rather than declaring a flat colour. */
const RINGS = [
  { r: 52, dash: "0.5 4", spin: "spin-220", so: 0.6 },
  { r: 46, dash: "1 3", spin: "spin-140", so: 0.85 },
  { r: 38, dash: undefined, spin: undefined, so: 0.7 },
  { r: 30, dash: undefined, spin: "spin-90-rev", so: 0.9 },
  { r: 22, dash: undefined, spin: undefined, so: 1 },
] as const;

/* Three, not four. Manufacturing fiducials are stamped where the tooling needed
   them, and tooling is not symmetrical. */
const FIDUCIALS = [45, 135, 225] as const;

/* Connection paths — chords from the outer boundary in toward the core. The
   protocol is wired, not decorated: four routes, one per cardinal quadrant. */
const CHORDS = [30, 120, 210, 300] as const;

const ELLIPSES = [
  { rx: 48, ry: 19, tilt: 18, color: `rgba(${BONE},0.14)`, dash: "2.5 2" },
  { rx: 42, ry: 15, tilt: -26, color: `rgba(${BONE},0.20)`, dash: undefined },
  { rx: 45, ry: 17, tilt: -60, color: "rgba(255,45,0,0.35)", dash: "1 2.5" },
] as const;

export function OrbitalCore({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none select-none ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <defs>
          {/* Titanium. userSpaceOnUse: the lit edge belongs to the room, not to
              the ring, so a spinning ring travels through the highlight. */}
          {/* The alpha floor is set so a ring's belly still reads at roughly the
              flat value it had before this pass; the ramp only adds a lit edge on
              top. Drop the floor to a "physically correct" 0.02 and the Core
              stops being legible as an object at all. */}
          <linearGradient id="mat-ti" gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="92" y2="92">
            <stop offset="0" stopColor={`rgb(${BONE})`} stopOpacity="0.4" />
            <stop offset="0.38" stopColor={`rgb(${BONE})`} stopOpacity="0.17" />
            <stop offset="0.68" stopColor={`rgb(${BONE})`} stopOpacity="0.14" />
            {/* Bounce light off the surface below. Metal is never black at its
                far edge; only its belly is. */}
            <stop offset="1" stopColor={`rgb(${BONE})`} stopOpacity="0.26" />
          </linearGradient>

          {/* Ceramic. Offset centre reads as ambient occlusion, not a highlight. */}
          <radialGradient id="mat-ceramic" gradientUnits="userSpaceOnUse" cx="42" cy="38" r="34">
            <stop offset="0" stopColor={`rgb(${BONE})`} stopOpacity="0.03" />
            <stop offset="1" stopColor={`rgb(${BONE})`} stopOpacity="0" />
          </radialGradient>

          {/* Blood energy, held. Deliberately dim and tight: at hero scale this
              circle is ~215px across, and anything brighter stops being an
              interior seen through a shell and becomes a lens flare behind the
              wordmark. It should be felt as warmth in the metal, not seen. */}
          <radialGradient id="mat-energy" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="11">
            <stop offset="0" stopColor="#FF2D00" stopOpacity="0.13" />
            <stop offset="0.55" stopColor="#FF2D00" stopOpacity="0.03" />
            <stop offset="1" stopColor="#FF2D00" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Cardinal instrument ticks */}
        {TICKS.map((deg) => (
          <line
            key={deg}
            x1="50"
            y1="4.5"
            x2="50"
            y2={deg % 90 === 0 ? "7.5" : "6.5"}
            stroke={`rgba(${BONE},0.18)`}
            strokeWidth="0.3"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}

        {/* Tilted elliptical orbits */}
        {ELLIPSES.map((el, i) => (
          <ellipse
            key={i}
            cx="50"
            cy="50"
            rx={el.rx}
            ry={el.ry}
            fill="none"
            stroke={el.color}
            strokeWidth="0.22"
            strokeDasharray={el.dash}
            transform={`rotate(${el.tilt} 50 50)`}
          />
        ))}

        {/* Connection paths — routes from the outer boundary (r=42) in toward the
            core ring (r=28). They stop short of the core: the protocol delivers
            to the lock, it does not pass through it. */}
        {CHORDS.map((deg) => (
          <line
            key={deg}
            x1="50"
            y1="8"
            x2="50"
            y2="22"
            stroke={`rgba(${BONE},0.11)`}
            strokeWidth="0.2"
            strokeDasharray="1 2"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}

        {/* Ceramic shell — the matte body the titanium rings are seated in. It
            has no edge of its own; it simply stops absorbing. */}
        <circle cx="50" cy="50" r="30" fill="url(#mat-ceramic)" />

        {/* Concentric rings — slow CSS rotation, static under reduced motion */}
        {RINGS.map((ring, i) => (
          <g key={i} className={ring.spin ? `orbit-spin ${ring.spin}` : undefined}>
            <circle
              cx="50"
              cy="50"
              r={ring.r}
              fill="none"
              stroke="url(#mat-ti)"
              strokeOpacity={ring.so}
              strokeWidth="0.25"
              strokeDasharray={ring.dash}
            />
          </g>
        ))}

        {/* The emissive rim: where the shell ends and the held energy begins. */}
        <circle cx="50" cy="50" r="22" fill="none" stroke="#FF2D00" strokeOpacity="0.12" strokeWidth="0.4" />

        {/* Laser fiducials — alignment marks left by the tooling. Sized so that
            at hero scale each arm is ~8px: present, but below the size at which
            the eye files them as decoration rather than as machining. */}
        {FIDUCIALS.map((deg) => (
          <g key={deg} transform={`rotate(${deg} 50 50)`} stroke={`rgba(${BONE},0.14)`} strokeWidth="0.13">
            <line x1="49.2" y1="16" x2="50.8" y2="16" />
            <line x1="50" y1="15.2" x2="50" y2="16.8" />
          </g>
        ))}

        {/* Cardinal square markers */}
        {[0, 90, 180, 270].map((deg) => (
          <rect
            key={deg}
            x="49.1"
            y="10.6"
            width="1.8"
            height="1.8"
            fill="none"
            stroke={`rgba(${BONE},0.5)`}
            strokeWidth="0.25"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}

        {/* The interior. Blood energy under the lock mechanism: the reason the
            titanium above it has anything to catch. */}
        <circle cx="50" cy="50" r="11" fill="url(#mat-energy)" />

        {/* Wireframe core — nested rotated squares, gently breathing (the
            locked-idle "lock mechanism": controlled energy, held). */}
        <g className="core-breath">
          <g className="orbit-spin spin-160">
            {[45, 75, 105].map((deg) => (
              <rect
                key={deg}
                x="44.5"
                y="44.5"
                width="11"
                height="11"
                fill="none"
                stroke={`rgba(${BONE},0.28)`}
                strokeWidth="0.25"
                transform={`rotate(${deg} 50 50)`}
              />
            ))}
          </g>
        </g>

        {/* Idle energy pulse — the protocol is powered even when nothing settles */}
        <circle
          className="core-pulse"
          cx="50"
          cy="50"
          r="9"
          fill="none"
          stroke={`rgba(${BONE},0.6)`}
          strokeWidth="0.2"
        />

        {/* Reaction ring — activates as the transaction signal reaches the core */}
        <circle
          className="core-react"
          cx="50"
          cy="50"
          r="8"
          fill="none"
          stroke="#FF2D00"
          strokeWidth="0.3"
        />

        {/* Single red-orange payment dot — the one surgical accent */}
        <g className="orbit-spin spin-34">
          <circle cx="90" cy="50" r="1.1" fill="#FF2D00" />
          <circle cx="90" cy="50" r="2.6" fill="none" stroke="#FF2D00" strokeWidth="0.2" opacity="0.3" />
        </g>

        {/* Secondary bone dot, counter-rotating */}
        <g className="orbit-spin spin-52-rev">
          <circle cx="80" cy="50" r="0.8" fill={`rgba(${BONE},0.8)`} />
        </g>

        {/* Ambient inner bone particle */}
        <g className="orbit-spin spin-22">
          <circle cx="72" cy="50" r="0.7" fill={`rgba(${BONE},0.65)`} />
        </g>

        {/* Transaction signal — periodically travels inward toward the core */}
        <g className="tx-signal">
          <circle cx="83" cy="50" r="1.1" fill="#FF2D00" />
        </g>

        {/* Still bone core point */}
        <circle cx="50" cy="50" r="1.4" fill={`rgba(${BONE},0.9)`} />

        {/* Laser engraved on the shell's lower face. At hero scale it is ~15px
            of real type; by the conflict chapter the Core has receded and it is
            gone. Nobody is meant to read it on the first pass. */}
        {/* `className`, not a `font-family` presentation attribute: a `var()` in a
            presentation attribute is not reliably resolved, and the mono face is
            already declared for `.font-mono-jb` under `.landing-root`. */}
        <text
          x="50"
          y="97.2"
          textAnchor="middle"
          className="font-mono-jb"
          fontSize="1.9"
          letterSpacing="0.55"
          fill={`rgba(${BONE},0.16)`}
        >
          TRSTP · ESC · R1
        </text>
      </svg>
    </div>
  );
}
