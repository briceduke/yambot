import { runStructure } from "./structure/run.ts";
import type { ScannerName, ScannerResult } from "./types.ts";

type ScannerRunner = () => Promise<ScannerResult>;

const runners: Readonly<Record<ScannerName, ScannerRunner>> = {
  structure: runStructure,
};

/**
 * Runs one scanner.
 * @param name - Scanner to run.
 * @returns Scanner result.
 */
export async function runScanner(name: ScannerName): Promise<ScannerResult> {
  return runners[name]();
}

/**
 * Runs every scanner (structure only).
 * @returns Results in fixed order.
 */
export async function runAllScanners(): Promise<readonly ScannerResult[]> {
  const names: readonly ScannerName[] = ["structure"];
  const results: ScannerResult[] = [];
  for (const name of names) {
    results.push(await runScanner(name));
  }
  return results;
}

/**
 * Returns true when `value` is a known scanner name.
 * @param value - CLI argument.
 * @returns Whether the value is a scanner name.
 */
export function isScannerName(value: string): value is ScannerName {
  return value === "structure";
}
