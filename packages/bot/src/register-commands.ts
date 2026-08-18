import { playSlashData } from "./commands/play.ts";
import { queueSlashData } from "./commands/queue.ts";
import { skipSlashData } from "./commands/skip.ts";

export const playSlashBody = playSlashData.toJSON();
export const skipSlashBody = skipSlashData.toJSON();
export const queueSlashBody = queueSlashData.toJSON();

export interface RegisterGuildCommandsInput {
  readonly applicationId: string;
  readonly guildId: string;
  readonly restPut: (
    guildId: string,
    body: readonly unknown[],
  ) => Promise<void>;
}

/**
 * Bulk-PUTs the three guild slash commands. Same-name PUT is idempotent.
 * @param input - Application id, guild id, and injected REST PUT.
 */
export async function registerGuildCommands(
  input: RegisterGuildCommandsInput,
): Promise<void> {
  await input.restPut(input.guildId, [
    playSlashBody,
    skipSlashBody,
    queueSlashBody,
  ]);
}
