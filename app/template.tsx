// Re-mounts on every route change, so this wrapper replays a quiet fade-in as you
// move between pages. Opacity-only (see .pt in globals.css) to stay sticky-safe;
// reduced-motion users get the instant page via the global motion gate.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pt">{children}</div>;
}
