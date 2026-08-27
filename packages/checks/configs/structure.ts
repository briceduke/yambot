/**
 * Structure check config. Filled by `/constitution` for this app's folder rules.
 * Empty means no patterns to enforce — a greenfield stamped app stays healthy.
 */

/**
 * One folder rule: each matched directory must contain the required files
 * and must not contain other files listed as forbidden.
 */
export interface ShapeRule {
  readonly id: string;
  /** Glob relative to the app root, e.g. `src/modules/*`. */
  readonly match: string;
  /** File names that must exist inside each match. */
  readonly requiredFiles: readonly string[];
  /** File names that must not exist inside each match. */
  readonly forbiddenFiles?: readonly string[];
}

/**
 * Full structure scanner config.
 */
export interface StructureConfig {
  readonly shapes: readonly ShapeRule[];
}

/**
 * Folder rules from `/constitution` (2026-08-11).
 * Package, engine, and bot folder rules. No exception list.
 */
export const structureConfig: StructureConfig = {
  shapes: [
    {
      id: "package-shape",
      match: "packages/*",
      requiredFiles: ["package.json", "tsconfig.json"],
    },
    {
      id: "engine-src",
      match: "packages/audio-engine/src",
      requiredFiles: ["track.ts", "track-queue.ts", "index.ts"],
    },
    {
      id: "engine-source-module",
      match: "packages/audio-engine/src/sources",
      requiredFiles: ["youtube.ts", "soundcloud.ts", "http.ts"],
    },
    {
      id: "bot-src",
      match: "packages/bot/src",
      requiredFiles: ["main.ts", "command-context.ts", "guild-music-session.ts"],
    },
    {
      id: "bot-command-module",
      match: "packages/bot/src/commands",
      requiredFiles: [
        "play.ts",
        "scsearch.ts",
        "skip.ts",
        "queue.ts",
        "pause.ts",
        "resume.ts",
        "nowplaying.ts",
        "remove.ts",
        "shuffle.ts",
        "clear.ts",
        "stop.ts",
      ],
    },
  ],
};
