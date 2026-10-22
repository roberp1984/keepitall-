"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function DownloadPdfLink({ href }: { href: string }) {
  return (
    <a href={href} className={cn(buttonVariants({ size: "lg" }), "w-full")} onClick={() => track("pack_downloaded")}>
      <Download />
      Download PDF
    </a>
  );
}
