"use client";
import { useRef, ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Motion director for the Valley Link page — scroll-triggered reveals in the same
// vocabulary as HomeMotion (tiles/panels rise + stagger, bars grow from their baseline).
// Everything lives inside the reduced-motion gate, so reduced-motion / no-JS users get
// the plain, already-correct static page.
export default function ValleyMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const root = scope.current!;
      const rise = (el: Element, sel: string, o: gsap.TweenVars = {}) => {
        const nodes = el.querySelectorAll(sel);
        if (nodes.length) gsap.from(nodes, {
          y: 24, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 82%" }, ...o,
        });
      };

      root.querySelectorAll<HTMLElement>(".scorecard").forEach((sec) => {
        gsap.from(sec.querySelector("summary"), { y: 16, autoAlpha: 0, duration: 0.5, ease: "power3.out",
          scrollTrigger: { trigger: sec, start: "top 85%" } });
        rise(sec, ".sc-lead");
        rise(sec, ".sc-tiles .t, .sc-contrast .side", { y: 28, stagger: 0.07 });
        rise(sec, ".sc-cols > div", { y: 20, stagger: 0.1 });
        rise(sec, ".sc-cols .sc-row", { y: 10, duration: 0.5, stagger: 0.025, ease: "power2.out" });

        // distribution / class bars grow from their left baseline (like the flagship chart)
        const bars = sec.querySelectorAll(".sc-bar i");
        if (bars.length) gsap.fromTo(bars, { scaleX: 0, transformOrigin: "0% 50%" },
          { scaleX: 1, transformOrigin: "0% 50%", duration: 0.9, ease: "power2.out", stagger: 0.02,
            scrollTrigger: { trigger: sec, start: "top 72%" } });

        // who-pays rows slide in
        const wp = sec.querySelector(".whopays");
        if (wp) gsap.from(wp.querySelectorAll("tbody tr"), { x: -12, autoAlpha: 0, duration: 0.5, stagger: 0.07,
          ease: "power2.out", scrollTrigger: { trigger: wp, start: "top 85%" } });
      });

      return () => {};
    });
    return () => mm.revert();
  }, { scope });

  return <div ref={scope}>{children}</div>;
}
