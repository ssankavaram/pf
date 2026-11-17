"use client";

import { useEffect, useRef } from "react";

/**
 * IconStack — row of overlapping tool circles with smooth proximity repel.
 * Ported from the Framer code component (physics unchanged; Framer property
 * controls replaced by props with the same defaults).
 *
 * Circles near the cursor get pushed away with spring physics; very close ones
 * flow around it. The nearest circle scales up slightly and a name tag rides
 * above it. On touch, the finger acts as the cursor and a tap lingers briefly.
 */

export type StackIcon = { name: string; src: string; background?: string; logoScale?: number };

type Props = {
  icons: StackIcon[];
  iconSize?: number;   // circle diameter
  logoScale?: number;  // logo size inside the circle, %
  gap?: number;        // negative = resting overlap
  radius?: number;     // how far from the cursor circles react
  strength?: number;   // push
  stiffness?: number;  // 0–1, how quickly circles chase their target
  bounciness?: number; // 0 = no overshoot
  orbit?: number;      // 0–1, how much very close circles flow around the cursor
  give?: number;       // 0–1, how lazily circles drift home
  spreadX?: number;
  spreadY?: number;
  tapHold?: number;    // ms a tap lingers on touch screens
  circleColor?: string;
  shadow?: boolean;
  ringWidth?: number;
  ringColor?: string;
  label?: string;      // accessible name for the row
};

type Spring = { x: number; y: number; vx: number; vy: number; sc: number; vsc: number };

export default function IconStack({
  icons,
  iconSize = 40,
  logoScale = 60,
  gap = -8,
  radius = 180,
  strength = 76,
  stiffness = 0.55,
  bounciness = 0,
  orbit = 0.7,
  give = 0.35,
  spreadX = 2.2,
  spreadY = 1,
  tapHold = 600,
  circleColor = "#f1f1f1",
  shadow = false,
  ringWidth = 2,
  ringColor = "#ffffff",
  label = "My stack",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const circleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nameTagRef = useRef<HTMLDivElement | null>(null);
  const nameTextRef = useRef<HTMLSpanElement | null>(null);
  const springs = useRef<Spring[]>([]);
  const tagSpring = useRef({ x: 0, y: 0, vx: 0, vy: 0, live: false });
  const activeName = useRef<string | null>(null);
  const mouse = useRef({ x: -99999, y: -99999 });
  const rafId = useRef(0);
  const running = useRef(false);
  const iconsRef = useRef(icons);
  iconsRef.current = icons;

  if (springs.current.length !== icons.length) {
    springs.current = icons.map((_, i) => springs.current[i] || { x: 0, y: 0, vx: 0, vy: 0, sc: 1, vsc: 0 });
  }

  useEffect(() => {
    // Reduced motion: circles stay put (name tags still appear on hover via the title attribute).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const k = 0.035 + stiffness * 0.1;
    const kReturn = k * (0.5 + (1 - give) * 0.5);
    const critFriction = Math.max(0.2, 1 - 2.2 * Math.sqrt(k));
    const friction = critFriction + bounciness * (0.94 - critFriction);
    const orbitZone = 0.55;
    const highlightR = Math.min(radius * 0.5, iconSize * 1.6);
    let lastTime = 0;

    const tick = (now: number) => {
      // Normalise to 60fps so 120Hz displays feel the same.
      const f = lastTime ? Math.min(Math.max((now - lastTime) / 16.67, 0.25), 2) : 1;
      lastTime = now;
      const fr = Math.pow(friction, f);
      let settled = true;
      const items = iconsRef.current;

      // Pass 1: measure + find the nearest circle
      const m: ({ rect: DOMRect; dx: number; dy: number; dist: number } | null)[] = [];
      let nearestIdx = -1;
      let nearestDist = Infinity;
      for (let i = 0; i < items.length; i++) {
        const slot = slotRefs.current[i];
        if (!slot) { m.push(null); continue; }
        const rect = slot.getBoundingClientRect();
        const s = springs.current[i];
        const cx = rect.left + rect.width / 2 + (s ? s.x : 0);
        const cy = rect.top + rect.height / 2 + (s ? s.y : 0);
        const dx = cx - mouse.current.x;
        const dy = cy - mouse.current.y;
        const dist = Math.hypot(dx, dy);
        m.push({ rect, dx, dy, dist });
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
      }
      const hasHighlight = nearestIdx >= 0 && nearestDist < highlightR;

      // Pass 2: integrate physics per circle
      for (let i = 0; i < items.length; i++) {
        const circle = circleRefs.current[i];
        const s = springs.current[i];
        const meas = m[i];
        if (!circle || !s || !meas) continue;
        const restX = meas.dx - s.x;
        const restY = meas.dy - s.y;
        const rDist = Math.hypot(restX, restY);
        let tx = 0;
        let ty = 0;
        if (rDist < radius && rDist > 0.0001) {
          const falloff = Math.pow(1 - rDist / radius, 1.3);
          const push = strength * falloff;
          const nx = restX / rDist;
          const ny = restY / rDist;
          let dirX = nx;
          let dirY = ny;
          const zone = radius * orbitZone;
          if (rDist < zone && orbit > 0) {
            const t = (1 - rDist / zone) * orbit;
            const sign = nx * restY >= 0 ? 1 : -1;
            dirX = nx * (1 - t) + -ny * sign * t;
            dirY = ny * (1 - t) + nx * sign * t;
            const len = Math.hypot(dirX, dirY) || 1;
            dirX /= len;
            dirY /= len;
          }
          tx = dirX * push * spreadX;
          ty = dirY * push * spreadY;
        }
        const kk = tx !== 0 || ty !== 0 ? k : kReturn;
        s.vx += (tx - s.x) * kk * f;
        s.vy += (ty - s.y) * kk * f;
        s.vx *= fr;
        s.vy *= fr;
        s.x += s.vx * f;
        s.y += s.vy * f;
        const scTarget = hasHighlight && i === nearestIdx ? 1.09 : 1;
        s.vsc += (scTarget - s.sc) * k * f;
        s.vsc *= fr;
        s.sc += s.vsc * f;
        if (
          Math.abs(s.x) > 0.05 || Math.abs(s.y) > 0.05 || Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05 ||
          Math.abs(s.sc - 1) > 0.002 || Math.abs(s.vsc) > 0.002 || tx !== 0 || ty !== 0
        ) settled = false;
        circle.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) scale(${s.sc})`;
      }

      // Name tag rides above the highlighted circle
      const tag = nameTagRef.current;
      const txt = nameTextRef.current;
      const container = containerRef.current;
      if (tag && txt && container) {
        const name = hasHighlight ? items[nearestIdx]?.name || null : null;
        const meas = hasHighlight ? m[nearestIdx] : null;
        if (name && meas) {
          const cRect = container.getBoundingClientRect();
          const s = springs.current[nearestIdx];
          const targetX = meas.rect.left + meas.rect.width / 2 + s.x - cRect.left;
          const targetY = meas.rect.top + s.y - (iconSize * (s.sc - 1)) / 2 - 10 - cRect.top;
          const t = tagSpring.current;
          if (!t.live) {
            Object.assign(t, { x: targetX, y: targetY, vx: 0, vy: 0, live: true });
          } else {
            t.vx += (targetX - t.x) * (k * 1.4) * f;
            t.vy += (targetY - t.y) * (k * 1.4) * f;
            t.vx *= fr;
            t.vy *= fr;
            t.x += t.vx * f;
            t.y += t.vy * f;
            if (Math.abs(targetX - t.x) > 0.1 || Math.abs(targetY - t.y) > 0.1) settled = false;
          }
          tag.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) translate(-50%, -100%)`;
          tag.style.opacity = "1";
          if (name !== activeName.current) {
            activeName.current = name;
            txt.textContent = name;
            txt.animate(
              [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0px)" }],
              { duration: 160, easing: "ease-out" },
            );
          }
        } else {
          tag.style.opacity = "0";
          activeName.current = null;
          tagSpring.current.live = false;
        }
      }

      if (settled) { running.current = false; return; }
      rafId.current = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!running.current) {
        running.current = true;
        lastTime = 0;
        rafId.current = requestAnimationFrame(tick);
      }
    };

    // Touch: after a tap the virtual cursor lingers for `tapHold` ms. Mobile browsers also fire
    // synthetic mouse events right after a tap; `lastTouch` lets us ignore those.
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTouch = 0;
    const isSyntheticMouse = () => performance.now() - lastTouch < 800;
    const clearMouse = () => { mouse.current.x = -99999; mouse.current.y = -99999; wake(); };
    const onMove = (e: MouseEvent) => {
      if (isSyntheticMouse()) return;
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      wake();
    };
    const onLeave = () => { if (!isSyntheticMouse()) clearMouse(); };
    const onTouch = (e: TouchEvent) => {
      lastTouch = performance.now();
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      const t = e.touches[0];
      if (t) { mouse.current.x = t.clientX; mouse.current.y = t.clientY; wake(); }
    };
    const onTouchEnd = (e: TouchEvent) => {
      lastTouch = performance.now();
      if (e.touches.length === 0) {
        if (touchTimer) clearTimeout(touchTimer);
        if (tapHold > 0) touchTimer = setTimeout(() => { touchTimer = null; clearMouse(); }, tapHold);
        else clearMouse();
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    wake();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      if (touchTimer) clearTimeout(touchTimer);
      cancelAnimationFrame(rafId.current);
      running.current = false;
    };
  }, [icons.length, iconSize, radius, strength, stiffness, bounciness, orbit, give, spreadX, spreadY, tapHold]);

  const boxShadow =
    [ringWidth > 0 ? `0 0 0 ${ringWidth}px ${ringColor}` : "", shadow ? "0 1px 2px rgba(0,0,0,0.12), 0 6px 16px rgba(0,0,0,0.12)" : ""]
      .filter(Boolean)
      .join(", ") || "none";

  return (
    <div ref={containerRef} className="stack" role="list" aria-label={label}>
      <div className="stack-row">
        {icons.map((item, i) => {
          const scale = Math.max(10, Math.min(250, logoScale + (item.logoScale || 0)));
          return (
            <div
              key={`${item.name}-${i}`}
              role="listitem"
              title={item.name}
              ref={(el) => { slotRefs.current[i] = el; }}
              style={{ width: iconSize, height: iconSize, flexShrink: 0, marginLeft: i === 0 ? 0 : gap }}
            >
              <div
                ref={(el) => { circleRefs.current[i] = el; }}
                className="stack-circle"
                style={{ background: item.background || circleColor, boxShadow }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.name} draggable={false} style={{ width: `${scale}%`, height: `${scale}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div ref={nameTagRef} className="stack-tag" aria-hidden>
        <span ref={nameTextRef} />
      </div>
    </div>
  );
}
