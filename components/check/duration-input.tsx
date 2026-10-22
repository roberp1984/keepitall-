"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

/** Hours + minutes → total minutes. Undefined until hours are entered. */
export function DurationInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (minutes: number | undefined) => void;
}) {
  const id = useId();
  const hours = value === undefined ? "" : String(Math.floor(value / 60));
  const minutes = value === undefined ? 0 : value % 60;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{label}</legend>
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${id}-h`} className="text-sm text-muted-foreground">
            Hours
          </label>
          <Input
            id={`${id}-h`}
            type="number"
            inputMode="numeric"
            min={0}
            max={72}
            value={hours}
            onChange={(e) => {
              const h = e.target.value === "" ? undefined : Math.max(0, Math.min(72, Math.floor(Number(e.target.value))));
              onChange(h === undefined || Number.isNaN(h) ? undefined : h * 60 + minutes);
            }}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${id}-m`} className="text-sm text-muted-foreground">
            Minutes
          </label>
          <select
            id={`${id}-m`}
            className="h-12 rounded-md border border-input bg-transparent px-3 text-base"
            value={minutes - (minutes % 5)}
            onChange={(e) => onChange((value === undefined ? 0 : Math.floor(value / 60) * 60) + Number(e.target.value))}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}
