"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { fmtI, fmtM, pctS, fmtAc } from "@/lib/data";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const FMT: Record<string, (n: number) => string> = { int: fmtI, money: fmtM, pct: pctS, acres: fmtAc };

// Counts 0 -> value when scrolled into view. SSR renders the real value (SEO / no-JS),
// and reduced-motion users keep the static number — the count-up branch never runs.
export default function CountUp({ value, fmt = "int", prefix = "", suffix = "", className, dur = 1.2 }:
  { value: number; fmt?: keyof typeof FMT | string; prefix?: string; suffix?: string; className?: string; dur?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = FMT[fmt] || FMT.int;

  useGSAP(() => {
    const el = ref.current!;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const o = { v: 0 };
      el.textContent = prefix + format(0) + suffix;               // pre-paint (layout effect): no flash
      gsap.to(o, {
        v: value, duration: dur, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => { el.textContent = prefix + format(o.v) + suffix; },
        onComplete: () => { el.textContent = prefix + format(value) + suffix; },
      });
    });
    return () => mm.revert();
  }, { scope: ref });

  return <span ref={ref} className={className}>{prefix + format(value) + suffix}</span>;
}
