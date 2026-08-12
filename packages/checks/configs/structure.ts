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
 * Per-package rules for `packages/bot` and `packages/audio-engine` land with
 * slice 1, when those folders exist — the scanner flags unmatched patterns.
 */
export const structureConfig: StructureConfig = {
  shapes: [
    {
      id: "package-shape",
      match: "packages/*",
      requiredFiles: ["package.json", "tsconfig.json"],
    },
  ],
};
