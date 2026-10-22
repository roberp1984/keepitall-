"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Large tap-target single-choice list (native radios for accessibility). */
export function ChoiceList<T extends string>({
  name,
  choices,
  value,
  onChange,
  legend,
}: {
  name: string;
  choices: Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  legend?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      {legend && <legend className="mb-2 font-medium">{legend}</legend>}
      {choices.map((c) => {
        const selected = c.value === value;
        return (
          <label
            key={c.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              selected ? "border-primary bg-accent" : "hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={selected}
              onChange={() => onChange(c.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                selected && "border-primary bg-primary text-primary-foreground",
              )}
              aria-hidden
            >
              {selected && <Check className="size-3" />}
            </span>
            <span className="flex flex-col">
              <span className="font-medium">{c.label}</span>
              {c.hint && <span className="text-sm text-muted-foreground">{c.hint}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function YesNo({
  name,
  legend,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <ChoiceList
      name={name}
      legend={legend}
      choices={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ]}
      value={value === undefined ? undefined : value ? "yes" : "no"}
      onChange={(v) => onChange(v === "yes")}
    />
  );
}
