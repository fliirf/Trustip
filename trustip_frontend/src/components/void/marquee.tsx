"use client";

type MarqueeProps = {
  items: string[];
  reverse?: boolean;
  separator?: string;
  className?: string;
};

export function Marquee({ items, reverse, separator = "·", className = "" }: MarqueeProps) {
  const doubled = [...items, ...items];
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className={`flex whitespace-nowrap ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center">
            <span className="font-mono-jb text-micro uppercase tracking-[0.22em] text-bone-60">
              {item}
            </span>
            <span className="mx-6 text-bone-20">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
