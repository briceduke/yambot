import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** One generated sine file and the temp dir to delete later. */
export interface SineFixture {
  readonly dir: string;
  readonly path: string;
}

/**
 * Writes a sine tone with ffmpeg. Returns null when ffmpeg fails.
 * @param input - File name, codec args, and duration.
 * @returns Fixture paths, or null.
 */
export function writeSineFixture(input: {
  readonly fileName: string;
  readonly durationSeconds: number;
  readonly extraArgs: readonly string[];
}): SineFixture | null {
  const dir: string = mkdtempSync(join(tmpdir(), "yambot-bench-"));
  const outPath: string = join(dir, input.fileName);
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=440:duration=${input.durationSeconds}`,
      ...input.extraArgs,
      outPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return null;
  }
  return { dir, path: outPath };
}

/**
 * Deletes a fixture temp dir.
 * @param fixture - Dir from `writeSineFixture`.
 */
export function removeSineFixture(fixture: SineFixture): void {
  rmSync(fixture.dir, { recursive: true, force: true });
}

/** Args for a webm/opus sine file. */
export const WEBM_OPUS_ARGS: readonly string[] = [
  "-c:a",
  "libopus",
  "-b:a",
  "64k",
  "-f",
  "webm",
];

/** Args for an mp3 sine file. */
export const MP3_ARGS: readonly string[] = [
  "-c:a",
  "libmp3lame",
  "-b:a",
  "96k",
  "-f",
  "mp3",
];

/** Args for an opus (Ogg) sine file when mp3 is missing. */
export const OGG_OPUS_ARGS: readonly string[] = [
  "-c:a",
  "libopus",
  "-b:a",
  "64k",
];
