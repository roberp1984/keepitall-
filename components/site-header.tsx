import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Keep<span className="text-primary">ItAll</span>
        </Link>
        <Link href="/check" className="text-sm font-medium text-primary hover:underline">
          Check my flight
        </Link>
      </div>
    </header>
  );
}
