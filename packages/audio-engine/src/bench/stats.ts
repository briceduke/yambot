/** One named sample set with percentile summary. */
export interface SampleSummary {
  readonly n: number;
  readonly p50: number;
  readonly p95: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Rounds a millisecond value to three decimal places.
 * @param value - Raw number.
 * @returns Rounded number.
 */
export function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Summarizes sample times in milliseconds.
 * @param samples - Measured values; must be non-empty.
 * @returns p50, p95, min, max, n.
 */
export function summarizeSamples(samples: readonly number[]): SampleSummary {
  if (samples.length === 0) {
    throw new Error("summarizeSamples needs at least one sample.");
  }
  const sorted: number[] = [...samples].sort((left, right) => left - right);
  return {
    n: sorted.length,
    p50: roundMs(percentile(sorted, 50)),
    p95: roundMs(percentile(sorted, 95)),
    min: roundMs(sorted[0] ?? 0),
    max: roundMs(sorted[sorted.length - 1] ?? 0),
  };
}

/**
 * Linear-interpolation percentile on a sorted list.
 * @param sorted - Ascending samples.
 * @param percent - 0–100.
 * @returns Interpolated value.
 */
export function percentile(sorted: readonly number[], percent: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0] ?? 0;
  }
  const rank: number = (percent / 100) * (sorted.length - 1);
  const lowIndex: number = Math.floor(rank);
  const highIndex: number = Math.ceil(rank);
  const low: number = sorted[lowIndex] ?? 0;
  const high: number = sorted[highIndex] ?? 0;
  if (lowIndex === highIndex) {
    return low;
  }
  return low + (high - low) * (rank - lowIndex);
}

/**
 * Runs `work` `n` times and summarizes elapsed milliseconds.
 * @param n - Repeat count.
 * @param work - Async body to time.
 * @returns Sample summary.
 */
export async function timeManyAsync(
  n: number,
  work: () => Promise<void>,
): Promise<SampleSummary> {
  const samples: number[] = [];
  for (let index = 0; index < n; index += 1) {
    const startedAt: number = performance.now();
    await work();
    samples.push(performance.now() - startedAt);
  }
  return summarizeSamples(samples);
}

/**
 * Sleeps for a number of milliseconds.
 * @param delayMs - Wait time.
 * @returns Resolves after the delay.
 */
export function sleepAsync(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Converts a byte count to mebibytes, rounded to two decimals.
 * @param bytes - RSS or heap bytes.
 * @returns MiB.
 */
export function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

/**
 * Reads an Error message, or String() for other values.
 * @param error - Caught value.
 * @returns Message text.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
