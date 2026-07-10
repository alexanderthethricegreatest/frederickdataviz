"use client";
import { useRef, ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// Homepage motion director. Everything lives inside a reduced-motion gate, so
// a reduced-motion user (or no-JS) gets the plain, already-correct static page.
export default function HomeMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const root = scope.current!;

      // --- Hero entrance (on load) ---
      const h1 = root.querySelector<HTMLElement>(".hero h1");
      let split: SplitText | null = null;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero .eyebrow", { y: 12, autoAlpha: 0, duration: 0.6 }, 0.05);
      if (h1) {
        split = SplitText.create(h1, { type: "lines", mask: "lines", linesClass: "sline" });
        tl.from(split.lines, { yPercent: 115, duration: 0.95, stagger: 0.11, ease: "power4.out" }, 0.15);
      }
      tl.from(".hero p", { y: 18, autoAlpha: 0, duration: 0.7 }, 0.5)
        .from(".hero .cta > *", { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.09 }, 0.65);

      // --- Mesh parallax (drift the background as you scroll) ---
      gsap.to(document.documentElement, {
        "--mesh-y": "120px", ease: "none",
        scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: true },
      });

      // --- Hero content parallaxes up + fades as it leaves ---
      gsap.to(".hero .wrap", {
        y: -70, autoAlpha: 0.35, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.5 },
      });

      // --- Stat tiles: rise + stagger in ---
      gsap.from(".g-tiles .tile", {
        y: 30, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease: "power3.out",
        scrollTrigger: { trigger: ".g-tiles", start: "top 85%" },
      });

      // --- Flagship chart: each bar grows from its own baseline, scrubbed by scroll ---
      gsap.fromTo(".gbar", { scaleY: 0, transformOrigin: "50% 100%" }, {
        scaleY: 1, transformOrigin: "50% 100%", ease: "none",
        stagger: { each: 0.012, from: "start" },
        scrollTrigger: { trigger: "svg.chart", start: "top 85%", end: "top 45%", scrub: 0.6 },
      });

      // --- Explore nav cards: rise + stagger in ---
      gsap.from(".navcard", {
        y: 32, autoAlpha: 0, duration: 0.7, stagger: 0.09, ease: "power3.out",
        scrollTrigger: { trigger: ".g-3", start: "top 82%" },
      });

      return () => { split?.revert(); };
    });

    return () => mm.revert();
  }, { scope });

  return <div ref={scope}>{children}</div>;
}
