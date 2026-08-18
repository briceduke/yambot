import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { pathExists, resolveAppRoot } from "../paths.ts";
import type { ScannerResult, Violation } from "../types.ts";

const SCANNER = "engine-seam" as const;
const RULE_R1 = "r1-no-discord";
const RULE_R2 = "r2-arrow";
const ENGINE_PACKAGE = "@yambot/audio-engine";
const BOT_PACKAGE = "@yambot/bot";
const IMPORT_SPECIFIER_PATTERN =
  /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

interface SeamRoots {
  readonly engineRoot: string;
  readonly botManifestPath: string | undefined;
  readonly requireBotManifest: boolean;
}

/**
 * Runs the engine-seam scanner: R1 (engine stays Discord-free) and R2
 * (bot depends on engine; engine does not depend on bot).
 * @param appRoot - Stamped app root. Tests may pass an engine package directory.
 * @returns Scanner result.
 */
export async function runEngineSeam(
  appRoot: string = resolveAppRoot(),
): Promise<ScannerResult> {
  const roots: SeamRoots = resolveSeamRoots(appRoot);
  const violations: Violation[] = [
    ...scanEngineManifest(roots.engineRoot, appRoot),
    ...scanEngineSource(roots.engineRoot, appRoot),
    ...scanBotDependsOnEngine(roots, appRoot),
  ];
  return { scanner: SCANNER, violations };
}

function resolveSeamRoots(root: string): SeamRoots {
  const nestedEngine: string = join(root, "packages/audio-engine");
  if (pathExists(join(nestedEngine, "package.json"))) {
    const botManifestPath: string = join(root, "packages/bot/package.json");
    return {
      engineRoot: nestedEngine,
      botManifestPath: pathExists(botManifestPath) ? botManifestPath : undefined,
      requireBotManifest: true,
    };
  }
  return {
    engineRoot: root,
    botManifestPath: undefined,
    requireBotManifest: false,
  };
}

function scanEngineManifest(
  engineRoot: string,
  appRoot: string,
): readonly Violation[] {
  const manifestPath: string = join(engineRoot, "package.json");
  if (!pathExists(manifestPath)) {
    return [
      {
        scanner: SCANNER,
        rule: RULE_R1,
        message: "packages/audio-engine/package.json is missing",
        path: toRel(appRoot, manifestPath),
      },
    ];
  }

  const violations: Violation[] = [];
  for (const name of readDependencyKeys(manifestPath)) {
    const rule: string | undefined = ruleForEngineDep(name);
    if (rule === undefined) {
      continue;
    }
    violations.push({
      scanner: SCANNER,
      rule,
      message: `engine depends on ${name}`,
      path: toRel(appRoot, manifestPath),
    });
  }
  return violations;
}

function scanEngineSource(
  engineRoot: string,
  appRoot: string,
): readonly Violation[] {
  if (!pathExists(engineRoot) || !statSync(engineRoot).isDirectory()) {
    return [
      {
        scanner: SCANNER,
        rule: RULE_R1,
        message: "packages/audio-engine is missing",
        path: toRel(appRoot, engineRoot),
      },
    ];
  }

  const violations: Violation[] = [];
  for (const filePath of listTsFiles(engineRoot)) {
    const source: string = readFileSync(filePath, "utf8");
    for (const specifier of collectImportSpecifiers(source)) {
      const rule: string | undefined = ruleForImport(specifier);
      if (rule === undefined) {
        continue;
      }
      violations.push({
        scanner: SCANNER,
        rule,
        message: `engine imports ${specifier}`,
        path: toRel(appRoot, filePath),
      });
    }
  }
  return violations;
}

function scanBotDependsOnEngine(
  roots: SeamRoots,
  appRoot: string,
): readonly Violation[] {
  if (!roots.requireBotManifest) {
    return [];
  }
  const manifestPath: string | undefined = roots.botManifestPath;
  if (manifestPath === undefined) {
    return [
      {
        scanner: SCANNER,
        rule: RULE_R2,
        message: "packages/bot/package.json is missing",
        path: "packages/bot/package.json",
      },
    ];
  }
  if (readNamedDependencies(manifestPath).includes(ENGINE_PACKAGE)) {
    return [];
  }
  return [
    {
      scanner: SCANNER,
      rule: RULE_R2,
      message: `bot does not depend on ${ENGINE_PACKAGE}`,
      path: toRel(appRoot, manifestPath),
    },
  ];
}

function ruleForEngineDep(name: string): string | undefined {
  if (name === BOT_PACKAGE) {
    return RULE_R2;
  }
  if (
    /discord/i.test(name) ||
    name === "discord.js" ||
    name === "@discordjs/voice"
  ) {
    return RULE_R1;
  }
  return undefined;
}

function ruleForImport(specifier: string): string | undefined {
  const normalized: string = specifier.replaceAll("\\", "/");
  if (
    normalized === "discord.js" ||
    normalized.startsWith("discord.js/") ||
    normalized.startsWith("@discordjs/")
  ) {
    return RULE_R1;
  }
  if (
    normalized === BOT_PACKAGE ||
    normalized.startsWith(`${BOT_PACKAGE}/`) ||
    (normalized.startsWith(".") && normalized.includes("/bot/"))
  ) {
    return RULE_R2;
  }
  return undefined;
}

function collectImportSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  const pattern: RegExp = new RegExp(IMPORT_SPECIFIER_PATTERN.source, "g");
  for (const match of source.matchAll(pattern)) {
    const specifier: string | undefined = match[1];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function listTsFiles(dir: string): readonly string[] {
  const result: string[] = [];
  collectTsFiles(dir, result);
  return result;
}

function collectTsFiles(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") {
      continue;
    }
    const fullPath: string = join(dir, name);
    if (statSync(fullPath).isDirectory()) {
      collectTsFiles(fullPath, out);
      continue;
    }
    if (name.endsWith(".ts")) {
      out.push(fullPath);
    }
  }
}

function readDependencyKeys(manifestPath: string): readonly string[] {
  const record: Record<string, unknown> = readJsonObject(manifestPath);
  return [
    ...keysOfMap(record.dependencies),
    ...keysOfMap(record.devDependencies),
    ...keysOfMap(record.peerDependencies),
    ...keysOfMap(record.optionalDependencies),
  ];
}

function readNamedDependencies(manifestPath: string): readonly string[] {
  return keysOfMap(readJsonObject(manifestPath).dependencies);
}

function readJsonObject(filePath: string): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

function keysOfMap(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.keys(value);
}

function toRel(root: string, absolute: string): string {
  return relative(root, absolute).replaceAll("\\", "/");
}
