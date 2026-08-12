import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { structureConfig, type ShapeRule } from "../../configs/structure.ts";
import { pathExists, resolveAppRoot } from "../paths.ts";
import type { ScannerResult, Violation } from "../types.ts";

/**
 * Runs the structure scanner: folder rules hold — required files exist
 * and nothing the rules forbid is present.
 * @returns Scanner result.
 */
export async function runStructure(): Promise<ScannerResult> {
  const appRoot: string = resolveAppRoot();
  const violations: Violation[] = [];

  for (const shape of structureConfig.shapes) {
    const matches: readonly string[] = expandMatch(appRoot, shape.match);

    if (matches.length === 0) {
      violations.push({
        scanner: "structure",
        rule: shape.id,
        message: `no directories matched "${shape.match}"`,
        path: shape.match,
      });
      continue;
    }

    for (const matchDir of matches) {
      violations.push(...checkShapeDir(appRoot, shape, matchDir));
    }
  }

  return { scanner: "structure", violations };
}

function checkShapeDir(
  appRoot: string,
  shape: ShapeRule,
  matchDir: string,
): readonly Violation[] {
  const violations: Violation[] = [];
  const relDir: string = relative(appRoot, matchDir).replaceAll("\\", "/");

  for (const fileName of shape.requiredFiles) {
    const filePath: string = join(matchDir, fileName);
    if (!pathExists(filePath)) {
      violations.push({
        scanner: "structure",
        rule: shape.id,
        message: `missing required file ${fileName}`,
        path: `${relDir}/${fileName}`,
      });
    }
  }

  const forbidden: readonly string[] = shape.forbiddenFiles ?? [];
  for (const fileName of forbidden) {
    const filePath: string = join(matchDir, fileName);
    if (pathExists(filePath)) {
      violations.push({
        scanner: "structure",
        rule: shape.id,
        message: `forbidden file ${fileName}`,
        path: `${relDir}/${fileName}`,
      });
    }
  }

  return violations;
}

/**
 * Expands a simple relative glob. Supports a trailing `/*` segment only.
 * Empty match with no wildcards is a single path.
 * @param appRoot - App root.
 * @param match - Relative match pattern.
 * @returns Absolute directories that match.
 */
function expandMatch(appRoot: string, match: string): readonly string[] {
  const normalized: string = match.replaceAll("\\", "/");

  if (!normalized.endsWith("/*")) {
    const absolute: string = join(appRoot, normalized);
    return pathExists(absolute) && isDirectory(absolute) ? [absolute] : [];
  }

  const parentRel: string = normalized.slice(0, -2);
  const parentAbs: string = join(appRoot, parentRel);
  if (!pathExists(parentAbs) || !isDirectory(parentAbs)) {
    return [];
  }

  return readdirSync(parentAbs)
    .map((name) => join(parentAbs, name))
    .filter((entry) => isDirectory(entry));
}

function isDirectory(path: string): boolean {
  return statSync(path).isDirectory();
}
