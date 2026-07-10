"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { DropdownMenu } from "@radix-ui/themes";

const LINKS: [string, string][] = [
  ["/", "Overview"],
  ["/map", "Map"],
  ["/fiscal", "Fiscal"],
  ["/land", "Where it lands"],
  ["/builders", "Who's building"],
  ["/applications", "Applications"],
  ["/votes", "How they voted"],
];

export default function NavLinks() {
  const path = usePathname();
  const isOn = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="nav">
      <div className="navlist">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={isOn(href) ? "on" : ""}>{label}</Link>
        ))}
      </div>
      <div className="navtoggle-wrap">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button className="navtoggle" aria-label="Menu"><Menu size={16} /> Menu</button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            {LINKS.map(([href, label]) => (
              <DropdownMenu.Item key={href} asChild>
                <Link href={href}>{label}</Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </nav>
  );
}
