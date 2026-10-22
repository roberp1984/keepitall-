"use client";

import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AirportOption } from "@/lib/airports/search";

export function airportLabel(a: AirportOption): string {
  return `${a.city || a.name} (${a.iata})`;
}

export function AirportPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: AirportOption | undefined;
  onChange: (airport: AirportOption | undefined) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AirportOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = (await res.json()) as { airports: AirportOption[] };
        setResults(data.airports);
      } catch {
        // aborted or offline: keep previous results
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-accent px-4 py-3">
        <span className="flex items-center gap-3">
          <MapPin className="size-5 text-primary" aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">{airportLabel(value)}</span>
            <span className="text-sm text-muted-foreground">{value.name}</span>
          </span>
        </span>
        <Button variant="ghost" size="icon" aria-label="Change airport" onClick={() => onChange(undefined)}>
          <X />
        </Button>
      </div>
    );
  }

  const shown = query.trim().length < 2 ? [] : results;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          autoFocus
          autoComplete="off"
          placeholder="City, airport or code (e.g. London, LHR)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <Loader2 className="absolute top-3.5 right-3 size-5 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      <ul className="flex flex-col gap-1" aria-live="polite">
        {shown.map((a) => (
          <li key={a.iata}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              onClick={() => {
                onChange(a);
                setQuery("");
              }}
            >
              <span className="flex flex-col">
                <span className="font-medium">{a.city || a.name}</span>
                <span className="text-sm text-muted-foreground">{a.name}</span>
              </span>
              <span className="font-mono text-sm font-semibold">{a.iata}</span>
            </button>
          </li>
        ))}
        {!loading && query.trim().length >= 2 && shown.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">No airports found. Try the city name or 3-letter code.</li>
        )}
      </ul>
    </div>
  );
}
