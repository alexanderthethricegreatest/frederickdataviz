"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Theme } from "@radix-ui/themes";

type Mode = "light" | "dark";
const Ctx = createContext<{ theme: Mode; toggle: () => void }>({ theme: "light", toggle: () => {} });
export const useTheme = () => useContext(Ctx);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Mode>("light");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "dark" ? "dark" : t === "light" ? "light" : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const toggle = () => setTheme((p) => {
    const n = p === "dark" ? "light" : "dark";
    try { localStorage.setItem("atlas_theme", n); } catch {}
    return n;
  });
  return (
    <Ctx.Provider value={{ theme, toggle }}>
      <Theme appearance={theme} accentColor="indigo" grayColor="slate" radius="large"
        panelBackground="translucent" scaling="100%" style={{ minHeight: "100dvh", background: "transparent" }}>
        {children}
      </Theme>
    </Ctx.Provider>
  );
}
