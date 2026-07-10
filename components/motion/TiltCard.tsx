"use client";
import { useRef, ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Magnetic 3D tilt toward the cursor. display:grid so the child still fills the
// grid cell (equal-height cards). No-ops under reduced-motion or on touch.
export default function TiltCard({ children, max = 7, className }:
  { children: ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = ref.current!;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
      gsap.set(el, { transformPerspective: 800 });
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
        ry(((e.clientX - r.left) / r.width - 0.5) * max * 2);
      };
      const leave = () => { rx(0); ry(0); };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
    });
    return () => mm.revert();
  }, { scope: ref });

  return <div ref={ref} className={className} style={{ display: "grid", willChange: "transform" }}>{children}</div>;
}
