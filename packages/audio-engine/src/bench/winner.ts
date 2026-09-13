import type { SampleSummary } from "./stats.ts";

/** Who won a lower-is-better row, or a live row we could not measure. */
export type WinnerName = "yambot" | "lavalink" | "tie" | "can't tell yet";

/** One bake-off or scale row Brice can scan. */
export interface WinnerRow {
  readonly metric: string;
  readonly yambotP50: number | null;
  readonly yambotP95: number | null;
  readonly lavalinkP50: number | null;
  readonly lavalinkP95: number | null;
  readonly deltaP50: number | null;
  readonly winner: WinnerName;
  readonly note: string;
}

/**
 * Builds one lower-is-better winner row.
 * @param metric - Row name.
 * @param yambot - yambot samples, or `null` when unverifiable.
 * @param lavalink - Lavalink samples, or `null` when unverifiable.
 * @param note - Short method note.
 * @returns Row with winner and p50 delta (yambot − Lavalink).
 */
export function buildWinnerRow(
  metric: string,
  yambot: SampleSummary | null,
  lavalink: SampleSummary | null,
  note: string,
): WinnerRow {
  return {
    metric,
    yambotP50: yambot?.p50 ?? null,
    yambotP95: yambot?.p95 ?? null,
    lavalinkP50: lavalink?.p50 ?? null,
    lavalinkP95: lavalink?.p95 ?? null,
    deltaP50: deltaOrNull(yambot?.p50 ?? null, lavalink?.p50 ?? null),
    winner: decideWinner(yambot, lavalink),
    note,
  };
}

/**
 * Picks the lower p50. Equal p50 is a tie. Missing side is can't tell yet.
 * @param yambot - Left samples.
 * @param lavalink - Right samples.
 * @returns Winner label.
 */
export function decideWinner(
  yambot: SampleSummary | null,
  lavalink: SampleSummary | null,
): WinnerName {
  if (yambot === null || lavalink === null) {
    return "can't tell yet";
  }
  if (yambot.p50 === lavalink.p50) {
    return "tie";
  }
  return yambot.p50 < lavalink.p50 ? "yambot" : "lavalink";
}

/**
 * Renders a markdown winner table.
 * @param rows - Rows to print.
 * @returns Markdown table plus a newline.
 */
export function winnerMarkdown(rows: readonly WinnerRow[]): string {
  const lines: string[] = [
    "| Metric | yambot p50 | yambot p95 | Lavalink p50 | Lavalink p95 | Δ p50 | winner |",
    "|---|---:|---:|---:|---:|---:|---|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.metric} | ${fmt(row.yambotP50)} | ${fmt(row.yambotP95)} | ${fmt(row.lavalinkP50)} | ${fmt(row.lavalinkP95)} | ${fmt(row.deltaP50)} | ${row.winner} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function deltaOrNull(
  yambotP50: number | null,
  lavalinkP50: number | null,
): number | null {
  if (yambotP50 === null || lavalinkP50 === null) {
    return null;
  }
  return Math.round((yambotP50 - lavalinkP50) * 1000) / 1000;
}

function fmt(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return String(value);
}
