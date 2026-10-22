/**
 * Downloads the OurAirports public-domain airports CSV and writes /data/airports.json.
 *
 *   npm run airports:generate                     # download
 *   npm run airports:generate -- --input file.csv # use a local copy
 *
 * isEU / isUK reflect the rulesets in force today (lib/rules/config).
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import regions from "../lib/rules/config/regions.json" with { type: "json" };
import rulesetsConfig from "../lib/rules/config/rulesets.json" with { type: "json" };
import { parseCsvRecords } from "./airports/csv.mts";
import { buildAirports } from "./airports/transform.mts";

const SOURCES = [
  "https://davidmegginson.github.io/ourairports-data/airports.csv",
  "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv",
];
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../data/airports.json");

async function download(): Promise<string> {
  const errors: string[] = [];
  for (const url of SOURCES) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`Downloaded ${url}`);
      return await res.text();
    } catch (err) {
      errors.push(`${url}: ${(err as Error).message}`);
    }
  }
  throw new Error(`All sources failed:\n  ${errors.join("\n  ")}`);
}

function currentTerritory(regime: string): { countries: Set<string>; excluded: Set<string> } {
  const today = new Date().toISOString().slice(0, 10);
  const ruleset = rulesetsConfig.rulesets.find(
    (r) => r.regime === regime && r.effectiveFrom <= today && (r.effectiveTo === null || today <= r.effectiveTo),
  );
  if (!ruleset) throw new Error(`No ${regime} ruleset in force on ${today}`);
  const groups = regions.groups as Record<string, string[]>;
  const countries = new Set(ruleset.territory.flatMap((g) => groups[g] ?? []));
  return { countries, excluded: new Set(Object.keys(regions.excludedAirports)) };
}

async function main() {
  const inputIdx = process.argv.indexOf("--input");
  const inputPath = inputIdx > -1 ? process.argv[inputIdx + 1] : undefined;
  if (inputIdx > -1 && !inputPath) throw new Error("--input requires a file path");
  const csv = inputPath ? await readFile(inputPath, "utf8") : await download();

  const eu = currentTerritory("EU261");
  const uk = currentTerritory("UK261");
  const airports = buildAirports(parseCsvRecords(csv), {
    euCountries: eu.countries,
    ukCountries: uk.countries,
    euExcludedAirports: eu.excluded,
    ukExcludedAirports: uk.excluded,
  });

  await writeFile(OUTPUT, JSON.stringify(airports) + "\n");
  const count = (f: (a: (typeof airports)[number]) => boolean) => airports.filter(f).length;
  console.log(
    `Wrote ${airports.length} airports to ${OUTPUT} (EU/EEA/CH: ${count((a) => a.isEU)}, UK: ${count((a) => a.isUK)}, scheduled: ${count((a) => a.scheduled)})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
