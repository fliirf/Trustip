"use client"

type MetaRow = {
  label: string
  value: string
  accent?: boolean
}

type MetaClusterProps = {
  rows: MetaRow[]
  className?: string
  align?: "left" | "right"
}

/**
 * Tiny mono metadata cluster — the VOID corner-annotation convention.
 * Used to punctuate empty quadrants with label/value micro-rows.
 */
export function MetaCluster({ rows, className = "", align = "left" }: MetaClusterProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${align === "right" ? "items-end" : ""} ${className}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-3">
          <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#C6C2B8]/50">
            {row.label}
          </span>
          <span
            className={`font-mono-jb text-[9px] uppercase tracking-[0.18em] ${
              row.accent ? "text-[#FF2D00]" : "text-[#C6C2B8]"
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
