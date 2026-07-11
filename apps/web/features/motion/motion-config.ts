/* Motion tokens — single source of truth for durations and easings across the
   app's future animations. Pure data, no imports, no side effects: safe to read
   from server or client. Easing strings are GSAP-compatible. */

export const duration = {
  fast: 0.3,
  normal: 0.6,
  slow: 1.1,
} as const;

export const easing = {
  smooth: "power2.out",
  cinematic: "power3.inOut",
  expo: "expo.out",
} as const;

export const motionConfig = { duration, easing } as const;

export type Duration = keyof typeof duration;
export type Easing = keyof typeof easing;
