import {
  loadMarkdown,
  runLoadBench,
  type LoadMode,
} from "../packages/bot/src/bench/load.ts";

const options = parseArgs(process.argv);
const report = await runLoadBench(options);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n\n`);
process.stdout.write(loadMarkdown(report));
for (const note of report.notes) {
  process.stdout.write(`${note}\n`);
}

function parseArgs(argv: readonly string[]): {
  readonly sessionCounts?: readonly number[];
  readonly mode?: LoadMode;
  readonly holdMs?: number;
} {
  return {
    sessionCounts: readList(argv, "--sessions"),
    mode: readMode(argv),
    holdMs: readNumber(argv, "--hold-ms"),
  };
}

function readList(
  argv: readonly string[],
  flag: string,
): readonly number[] | undefined {
  const raw: string | undefined = flagValue(argv, flag);
  if (raw === undefined) {
    return undefined;
  }
  const parsed: number[] = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= 1)
    .map((value) => Math.floor(value));
  return parsed.length === 0 ? undefined : parsed;
}

function readNumber(argv: readonly string[], flag: string): number | undefined {
  const raw: string | undefined = flagValue(argv, flag);
  if (raw === undefined) {
    return undefined;
  }
  const parsed: number = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

function readMode(argv: readonly string[]): LoadMode | undefined {
  const raw: string | undefined = flagValue(argv, "--mode");
  if (raw === "mock" || raw === "webm" || raw === "http") {
    return raw;
  }
  return undefined;
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index: number = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}
