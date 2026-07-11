"use client";
import { useId, useState, ReactNode } from "react";

type Tab = { key: string; label: string; hint?: string; node: ReactNode };

// One-at-a-time switch between the two voting bodies. Both panels are rendered
// (kept in the DOM, hidden via [hidden]) so their content stays in the RSC
// payload and the charts' reveal-on-scroll fires when a panel is first shown.
export default function BoardSwitcher({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const base = useId();
  return (
    <>
      <div className="boardswitch">
        <span className="boardswitch-lab">Voting body</span>
        <div className="seg" role="tablist" aria-label="Choose a voting body">
          {tabs.map((t) => {
            const on = active === t.key;
            return (
              <button key={t.key} role="tab" id={`${base}-${t.key}-tab`}
                aria-selected={on} aria-controls={`${base}-${t.key}-panel`}
                className={on ? "on" : ""} onClick={() => setActive(t.key)}>
                {t.label}{t.hint && <span className="seg-hint"> · {t.hint}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`${base}-${t.key}-panel`}
          aria-labelledby={`${base}-${t.key}-tab`} hidden={active !== t.key}>
          {t.node}
        </div>
      ))}
    </>
  );
}
