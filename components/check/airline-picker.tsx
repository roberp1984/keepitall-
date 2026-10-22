"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import type { CarrierChoice, CarrierRegion } from "@/lib/check/answers";
import { ChoiceList } from "./choice-list";

export interface AirlineOption {
  slug: string;
  name: string;
  iata: string;
}

const REGIONS: { value: CarrierRegion; label: string; hint?: string }[] = [
  { value: "eu", label: "An airline based in the EU" },
  { value: "uk", label: "An airline based in the UK" },
  { value: "eea_ch", label: "A Norwegian, Icelandic or Swiss airline" },
  { value: "other", label: "Another airline, or I'm not sure", hint: "Flights leaving the EU or UK are covered whatever the airline." },
];

export function AirlinePicker({
  airlines,
  value,
  onChange,
}: {
  airlines: AirlineOption[];
  value: CarrierChoice | undefined;
  onChange: (carrier: CarrierChoice) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [notListed, setNotListed] = useState(value?.kind === "region");

  const q = query.trim().toLowerCase();
  const matches = q
    ? airlines.filter((a) => a.name.toLowerCase().includes(q) || a.iata.toLowerCase() === q)
    : airlines;

  if (notListed) {
    return (
      <div className="flex flex-col gap-4">
        <ChoiceList
          name="region"
          legend="Where is the airline based?"
          choices={REGIONS}
          value={value?.kind === "region" ? value.region : undefined}
          onChange={(region) => onChange({ kind: "region", region })}
        />
        <button type="button" className="self-start text-sm text-primary underline" onClick={() => setNotListed(false)}>
          Back to the airline list
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="sr-only">
        Search airlines
      </label>
      <Input id={id} placeholder="Search airlines" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      <p className="text-sm text-muted-foreground">
        Choose the airline that actually operated the flight. It’s shown on your boarding pass.
      </p>
      <div className="max-h-80 overflow-y-auto rounded-lg border">
        <ChoiceList
          name="airline"
          choices={matches.map((a) => ({ value: a.slug, label: a.name, hint: a.iata }))}
          value={value?.kind === "airline" ? value.slug : undefined}
          onChange={(slug) => onChange({ kind: "airline", slug })}
        />
      </div>
      <button type="button" className="self-start text-sm text-primary underline" onClick={() => setNotListed(true)}>
        My airline isn’t listed
      </button>
    </div>
  );
}
