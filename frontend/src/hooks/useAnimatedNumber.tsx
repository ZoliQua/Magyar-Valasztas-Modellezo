import { useEffect, useRef, useState } from 'react';

/** Csökkentett mozgás preferencia (akadálymentesség) — ilyenkor nincs animáció. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Egész szám animált megjelenítése: az előző értékről az újra "számol fel/le".
 * Csak a megjelenítést animálja — a nyers érték változatlanul a hívónál marad.
 */
export function useAnimatedNumber(value: number, duration = 600): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value || prefersReducedMotion()) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (value - from) * eased);
      fromRef.current = current;
      setDisplay(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}

/** Animált szám komponensként — listákban (ahol hook nem hívható ciklusban). */
export function AnimatedNumber({ value, duration }: { value: number; duration?: number }) {
  return <>{useAnimatedNumber(value, duration)}</>;
}
