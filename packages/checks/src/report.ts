import type { ScannerResult, Violation } from "./types.ts";

/**
 * Prints a scanner result and returns the process exit code.
 * @param result - Scanner result.
 * @returns `0` when healthy, `1` when violations remain.
 */
export function reportResult(result: ScannerResult): number {
  const { scanner, violations } = result;

  if (violations.length === 0) {
    console.log(`[${scanner}] ok`);
    return 0;
  }

  console.error(`[${scanner}] ${String(violations.length)} violation(s)`);
  for (const violation of violations) {
    console.error(formatViolation(violation));
  }
  return 1;
}

/**
 * Prints combined results from every scanner.
 * @param results - One result per scanner.
 * @returns `0` when all healthy, `1` when any violation remains.
 */
export function reportAll(results: readonly ScannerResult[]): number {
  let exitCode = 0;
  for (const result of results) {
    const code = reportResult(result);
    if (code !== 0) {
      exitCode = 1;
    }
  }
  return exitCode;
}

function formatViolation(violation: Violation): string {
  const location =
    violation.path === undefined ? "" : ` @ ${violation.path}`;
  return `  - ${violation.rule}${location}: ${violation.message}`;
}
