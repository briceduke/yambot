import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir: string = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to this checks package root (`packages/checks`).
 * @returns Package root directory.
 */
export function resolveChecksRoot(): string {
  return resolve(packageDir, "..");
}

/**
 * Absolute path to the stamped app root (two levels above `packages/checks`).
 * @returns App root directory.
 */
export function resolveAppRoot(): string {
  return resolve(resolveChecksRoot(), "../..");
}

/**
 * Returns true when `path` exists on disk.
 * @param path - Absolute or relative path to test.
 * @returns Whether the path exists.
 */
export function pathExists(path: string): boolean {
  return existsSync(path);
}
