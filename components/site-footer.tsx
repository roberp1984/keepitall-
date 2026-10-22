import Link from "next/link";
import { Disclaimer } from "./disclaimer";

const LINKS = [
  { href: "/airlines", label: "Airlines" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <Disclaimer />
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">
          We are not affiliated with any airline. We never sell your data.
        </p>
      </div>
    </footer>
  );
}
