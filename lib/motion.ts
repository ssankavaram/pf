// One motion system for the whole site. GSAP drives every JS animation with these values,
// and the matching CSS custom properties in globals.css (--ease-out, --dur-base, …) drive the
// few hover transitions, so everything moves with the same feel.
import type Lenis from "lenis";

export const EASE = {
  out: "expo.out",        // things arriving or responding: fast start, long soft landing
  inOut: "power3.inOut",  // things travelling from A to B
  spring: "back.out(1.6)", // small playful pops (stickers, highlights)
  drift: "sine.inOut",     // slow ambient floating (background glow)
} as const;

export const DUR = {
  fast: 0.25, // hovers, small UI feedback
  base: 0.5,  // text and panels changing
  slow: 0.9,  // entrances, drawing
} as const;

export const STAGGER = 0.04; // between items in a list
export const SCRUB = 0.6;    // how far scroll-linked animation trails the scrollbar, in seconds

// Smooth scrolling (Lenis). Set by <SmoothScroll />; null when the visitor prefers reduced motion.
let lenis: Lenis | null = null;
export const setLenis = (l: Lenis | null) => { lenis = l; };
/** Scroll to a position, gliding with Lenis when it's running. */
export function scrollToY(y: number, onComplete?: () => void) {
  if (lenis) lenis.scrollTo(y, { duration: 1.2, onComplete: () => onComplete?.() });
  else { window.scrollTo({ top: y }); onComplete?.(); }
}
