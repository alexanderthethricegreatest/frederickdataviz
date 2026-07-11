"use client";
import { useRef, ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Button that drifts toward the cursor and springs back on leave. The pull lives
// on an INNER span so an outer entrance animation (y/opacity) can share the node
// without fighting for `transform`. No-ops under reduced motion or on touch.
export default function Magnetic({ children, strength = 0.35, className }:
  { children: ReactNode; strength?: number; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const host = outer.current!, el = inner.current!;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
      const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * strength);
        y((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const leave = () => { x(0); y(0); };
      host.addEventListener("pointermove", move);
      host.addEventListener("pointerleave", leave);
      return () => { host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); };
    });
    return () => mm.revert();
  }, { scope: outer });

  return (
    <span ref={outer} className={className} style={{ display: "inline-flex" }}>
      <span ref={inner} style={{ display: "inline-flex", willChange: "transform" }}>{children}</span>
    </span>
  );
}
