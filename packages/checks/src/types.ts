/**
 * Shared types for constitution scanners.
 */

export type ScannerName = "structure" | "engine-seam";

/**
 * One failed check reported by a scanner.
 */
export interface Violation {
  readonly scanner: ScannerName;
  readonly rule: string;
  readonly message: string;
  readonly path?: string;
}

/**
 * Result of one scanner run.
 */
export interface ScannerResult {
  readonly scanner: ScannerName;
  readonly violations: readonly Violation[];
}
