import { Info } from "lucide-react";
import { DISCLAIMER } from "@/lib/legal";
import { cn } from "@/lib/utils";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted-foreground", className)}>
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      {DISCLAIMER}
    </p>
  );
}
