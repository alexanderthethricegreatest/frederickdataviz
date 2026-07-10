import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { Map } from "lucide-react";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import NavLinks from "@/components/NavLinks";

// Self-hosted at build time (no external CDN, no layout shift).
// Space Grotesk = geometric display face; Inter = workhorse UI/body with strong tabular figures.
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
// Institutional/technical mono for case IDs, PINs, coordinates, dates & drawing labels.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Frederick County Growth Atlas",
  description: "An independent planning atlas for Frederick County, VA — every land-use application, its full pipeline, and what growth costs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('atlas_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <header className="topbar">
            <div className="wrap">
              <Link href="/" className="logo">
                <span className="dot"><Map size={13} /></span>
                Growth Atlas <span className="muted" style={{ fontWeight: 500 }}>· Frederick County</span>
              </Link>
              <NavLinks />
              <ThemeToggle />
            </div>
          </header>
          {children}
          <footer className="footer">
            <div className="wrap">
              An independent atlas built from open county GIS, building permits, and the planning docket.
              Figures reflect the data snapshot; 2026 is year-to-date. Not an official county product.
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
