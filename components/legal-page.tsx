import type { ReactNode } from "react";
import { SITE } from "@/lib/site";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10 leading-relaxed">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">Last updated: {SITE.legalUpdated}</p>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SupportLink() {
  return (
    <a href={`mailto:${SITE.supportEmail}`} className="font-medium underline">
      {SITE.supportEmail}
    </a>
  );
}
