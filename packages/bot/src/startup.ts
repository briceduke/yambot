export const missingTokenMessage =
  "DISCORD_TOKEN is missing. Set it in the environment and start again.";

export const disallowedIntentsMessage =
  "Enable the Message Content intent in the Discord developer portal, then restart.";

/**
 * Exits when `DISCORD_TOKEN` is missing or blank.
 * @param env - Process environment.
 * @param write - Writes the error message (usually `console.error`).
 * @param exit - Exits the process (usually `process.exit`).
 * @returns The token when it is present.
 */
export function requireDiscordToken(
  env: NodeJS.ProcessEnv,
  write: (message: string) => void,
  exit: (code: number) => void,
): string {
  const token: string | undefined = env["DISCORD_TOKEN"];
  if (token === undefined || token.trim().length === 0) {
    write(missingTokenMessage);
    exit(1);
    return "";
  }
  return token;
}

/**
 * Exits on gateway close code 4014 (disallowed intents). Other codes are ignored.
 * @param code - WebSocket close code.
 * @param write - Writes the error message (usually `console.error`).
 * @param exit - Exits the process (usually `process.exit`).
 */
export function exitIfDisallowedIntents(
  code: number,
  write: (message: string) => void,
  exit: (code: number) => void,
): void {
  if (code !== 4014) {
    return;
  }
  write(disallowedIntentsMessage);
  exit(1);
}
