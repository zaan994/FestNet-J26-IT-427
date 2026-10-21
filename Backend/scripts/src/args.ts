/**
 * Command-line parsing for the scripts. Accepts both styles:
 *
 *   npm run admin user email=a@b.c password=secret role=organiser      (works in every shell)
 *   npm run admin -- user --email a@b.c --password secret              (bash / cmd)
 *
 * The `key=value` style exists because Windows PowerShell swallows a bare `--`, after which
 * npm treats `--email` etc. as its own options and drops them before the script runs.
 */
import { parseArgs } from "node:util";

export interface Cli<K extends string> {
  /** Positional words that are not key=value pairs (e.g. the sub-command). */
  positionals: string[];
  values: Partial<Record<K, string>>;
}

export function parseCli<K extends string>(names: readonly K[], defaults: Partial<Record<K, string>> = {}): Cli<K> {
  const options = Object.fromEntries(names.map((n) => [n, { type: "string" as const }]));
  const parsed = parseArgs({ allowPositionals: true, strict: false, options });

  const values: Partial<Record<K, string>> = { ...defaults };
  for (const [key, value] of Object.entries(parsed.values)) {
    if (typeof value === "string" && (names as readonly string[]).includes(key)) values[key as K] = value;
  }

  const positionals: string[] = [];
  for (const word of parsed.positionals) {
    const match = word.match(/^([A-Za-z]+)=(.*)$/);
    if (match && (names as readonly string[]).includes(match[1])) {
      values[match[1] as K] = match[2];
    } else {
      positionals.push(word);
    }
  }
  return { positionals, values };
}

/** Exits with a helpful message when a required value is missing. */
export function requireValue<K extends string>(cli: Cli<K>, name: K): string {
  const value = cli.values[name];
  if (typeof value === "string" && value !== "") return value;
  console.error(`Missing ${name}=...  (example: ${name}=value)`);
  if (cli.positionals.length > 1) {
    console.error(
      "Your --flags were removed before reaching the script (PowerShell + npm). " +
        "Use key=value instead, e.g.: npm run admin user email=you@x.com password=secret role=organiser",
    );
  }
  process.exit(1);
}
