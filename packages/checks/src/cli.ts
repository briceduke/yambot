#!/usr/bin/env bun

import { reportAll, reportResult } from "./report.ts";
import { isScannerName, runAllScanners, runScanner } from "./run-all.ts";

/**
 * CLI entry: `bun run ./src/cli.ts [structure]`
 * With no argument, runs the structure scanner.
 */
async function main(): Promise<void> {
  const arg: string | undefined = process.argv[2];

  if (arg === undefined) {
    const results = await runAllScanners();
    process.exit(reportAll(results));
  }

  if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  }

  if (!isScannerName(arg)) {
    console.error(`Unknown scanner: ${arg}`);
    printHelp();
    process.exit(2);
  }

  const result = await runScanner(arg);
  process.exit(reportResult(result));
}

function printHelp(): void {
  console.log(`Usage: bun run ./src/cli.ts [scanner]

Scanners:
  structure     Folder rules: required files exist and forbidden files do not

With no scanner name, runs structure.
`);
}

await main();
