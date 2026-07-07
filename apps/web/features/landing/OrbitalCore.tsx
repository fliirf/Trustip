/* Server component — the hero's protected-core artifact, ported from the
   prototype's OrbitalCore but animated purely with CSS (motion-safe classes).
   Every SVG length attribute is a literal: nothing can render "undefined". */

const BONE = "237,234,227";
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

const RINGS = [
  { r: 46, dash: "1 3", spin: "spin-140", opacity: 0.16 },
  { r: 38, dash: undefined, spin: undefined, opacity: 0.12 },
  { r: 30, dash: undefined, spin: "spin-90-rev", opacity: 0.18 },
  { r: 22, dash: undefined, spin: undefined, opacity: 0.24 },
] as const;

const ELLIPSES = [
  { rx: 48, ry: 19, tilt: 18, color: `rgba(${BONE},0.14)`, dash: "2.5 2" },
  { rx: 42, ry: 15, tilt: -26, color: `rgba(${BONE},0.20)`, dash: undefined },
  { rx: 45, ry: 17, tilt: -60, color: "rgba(255,45,0,0.35)", dash: "1 2.5" },
] as const;

export function OrbitalCore({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none select-none ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
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

        {/* Concentric rings — slow CSS rotation, static under reduced motion */}
        {RINGS.map((ring, i) => (
          <g key={i} className={ring.spin ? `orbit-spin ${ring.spin}` : undefined}>
            <circle
              cx="50"
              cy="50"
              r={ring.r}
              fill="none"
              stroke={`rgba(${BONE},${ring.opacity})`}
              strokeWidth="0.25"
              strokeDasharray={ring.dash}
            />
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

        {/* Wireframe core — nested rotated squares */}
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

        {/* Single red-orange payment dot — the one surgical accent */}
        <g className="orbit-spin spin-34">
          <circle cx="90" cy="50" r="1.1" fill="#FF2D00" />
          <circle cx="90" cy="50" r="2.6" fill="none" stroke="#FF2D00" strokeWidth="0.2" opacity="0.3" />
        </g>

        {/* Secondary bone dot, counter-rotating */}
        <g className="orbit-spin spin-52-rev">
          <circle cx="80" cy="50" r="0.8" fill={`rgba(${BONE},0.8)`} />
        </g>

        {/* Still bone core point */}
        <circle cx="50" cy="50" r="1.4" fill={`rgba(${BONE},0.9)`} />
      </svg>
    </div>
  );
}
