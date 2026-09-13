import { spawn, type ChildProcess } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LAVALINK_JAR_URL,
  LAVALINK_PASSWORD,
  LAVALINK_VERSION,
  YOUTUBE_PLUGIN_URL,
  YOUTUBE_PLUGIN_VERSION,
} from "./pin.ts";

const CACHE_DIR = join(tmpdir(), "yambot-lavalink-cache");
const READY_TIMEOUT_MS = 90_000;

/** Running throwaway Lavalink plus the work directory to delete later. */
export interface LavalinkProcess {
  readonly pid: number;
  readonly port: number;
  readonly password: string;
  readonly workDir: string;
  readonly child: ChildProcess;
}

/**
 * Downloads the pinned jar if needed, writes yml, and waits until REST is up.
 * @param port - Localhost port.
 * @returns Running process handle.
 */
export async function startLavalinkAsync(port: number): Promise<LavalinkProcess> {
  assertJava();
  const jarPath: string = await cacheFileAsync(
    LAVALINK_JAR_URL,
    join(CACHE_DIR, `Lavalink-${LAVALINK_VERSION}.jar`),
  );
  const workDir: string = join(tmpdir(), `yambot-ll-${process.pid}-${port}`);
  mkdirSync(join(workDir, "plugins"), { recursive: true });
  mkdirSync(join(workDir, "logs"), { recursive: true });
  try {
    const pluginPath: string = await cacheFileAsync(
      YOUTUBE_PLUGIN_URL,
      join(CACHE_DIR, `youtube-plugin-${YOUTUBE_PLUGIN_VERSION}.jar`),
    );
    copyFileSync(
      pluginPath,
      join(workDir, "plugins", `youtube-plugin-${YOUTUBE_PLUGIN_VERSION}.jar`),
    );
  } catch {
    // HTTP fixtures do not need the plugin. Live YouTube rows become can't tell yet.
  }
  writeFileSync(join(workDir, "application.yml"), applicationYml(port), "utf8");
  const child: ChildProcess = spawn("java", ["-jar", jarPath], {
    cwd: workDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  const pid: number | undefined = child.pid;
  if (pid === undefined) {
    throw new Error("Lavalink did not start (no pid).");
  }
  try {
    await waitReadyAsync(port, pid);
  } catch (error) {
    stopLavalink(child);
    throw error;
  }
  return {
    pid,
    port,
    password: LAVALINK_PASSWORD,
    workDir,
    child,
  };
}

/**
 * Sends SIGTERM to the Lavalink pid. SIGKILL after 5s if it is still alive.
 * @param child - Spawned Java process.
 */
export function stopLavalink(child: ChildProcess): void {
  const pid: number | undefined = child.pid;
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  setTimeout(() => {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      return;
    }
  }, 5_000).unref();
}

/**
 * Reads Java -version text.
 * @returns First line of stderr/stdout.
 */
export function readJavaVersion(): string {
  assertJava();
  const result = Bun.spawnSync(["java", "-version"], { stderr: "pipe", stdout: "pipe" });
  const text: string = `${result.stderr}${result.stdout}`.toString();
  return text.split("\n")[0]?.trim() ?? "java";
}

function assertJava(): void {
  const result = Bun.spawnSync(["java", "-version"], { stderr: "pipe", stdout: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(
      "Java is required for bun run bench:vs-lavalink. Install a JDK 17+ and retry. bun test / CI stay Java-free.",
    );
  }
}

async function cacheFileAsync(url: string, dest: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  if (existsSync(dest)) {
    return dest;
  }
  const response: Response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Could not download ${url}: HTTP ${response.status}`);
  }
  await Bun.write(dest, response);
  return dest;
}

async function waitReadyAsync(port: number, pid: number): Promise<void> {
  const startedAt: number = Date.now();
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    if (!pidAlive(pid)) {
      throw new Error("Lavalink exited before it became ready.");
    }
    try {
      const response: Response = await fetch(`http://127.0.0.1:${port}/v4/info`, {
        headers: { Authorization: LAVALINK_PASSWORD },
      });
      if (response.ok) {
        return;
      }
    } catch {
      await Bun.sleep(250);
      continue;
    }
    await Bun.sleep(250);
  }
  throw new Error(`Lavalink did not answer /v4/info within ${READY_TIMEOUT_MS} ms.`);
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function applicationYml(port: number): string {
  return `server:
  port: ${port}
  address: 127.0.0.1
lavalink:
  pluginsDir: ./plugins
  server:
    password: "${LAVALINK_PASSWORD}"
    sources:
      youtube: false
      bandcamp: false
      soundcloud: true
      twitch: false
      vimeo: false
      nico: false
      http: true
      local: true
    filters:
      volume: false
      equalizer: false
      karaoke: false
      timescale: false
      tremolo: false
      vibrato: false
      distortion: false
      rotation: false
      channelMix: false
      lowPass: false
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    playerUpdateInterval: 1
    gc-warnings: false
logging:
  file:
    path: ./logs/
  level:
    root: WARN
    lavalink: INFO
`;
}
