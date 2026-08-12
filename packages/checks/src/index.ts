/**
 * Public entry for the checks package.
 */

export { resolveAppRoot, resolveChecksRoot } from "./paths.ts";
export { reportAll, reportResult } from "./report.ts";
export { isScannerName, runAllScanners, runScanner } from "./run-all.ts";
export { runStructure } from "./structure/run.ts";
export type { ScannerName, ScannerResult, Violation } from "./types.ts";
