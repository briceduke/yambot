import { clearSlashData } from "./commands/clear.ts";
import { helpSlashData } from "./commands/help.ts";
import { nowplayingSlashData } from "./commands/nowplaying.ts";
import { pauseSlashData } from "./commands/pause.ts";
import { playSlashData } from "./commands/play.ts";
import { prefixSlashData } from "./commands/prefix.ts";
import { queueSlashData } from "./commands/queue.ts";
import { removeSlashData } from "./commands/remove.ts";
import { resumeSlashData } from "./commands/resume.ts";
import { scsearchSlashData } from "./commands/scsearch.ts";
import { setdjSlashData } from "./commands/setdj.ts";
import { settingsSlashData } from "./commands/settings.ts";
import { settcSlashData } from "./commands/settc.ts";
import { setvcSlashData } from "./commands/setvc.ts";
import { shuffleSlashData } from "./commands/shuffle.ts";
import { skipSlashData } from "./commands/skip.ts";
import { stopSlashData } from "./commands/stop.ts";

export const playSlashBody = playSlashData.toJSON();
export const scsearchSlashBody = scsearchSlashData.toJSON();
export const skipSlashBody = skipSlashData.toJSON();
export const queueSlashBody = queueSlashData.toJSON();
export const pauseSlashBody = pauseSlashData.toJSON();
export const resumeSlashBody = resumeSlashData.toJSON();
export const nowplayingSlashBody = nowplayingSlashData.toJSON();
export const removeSlashBody = removeSlashData.toJSON();
export const shuffleSlashBody = shuffleSlashData.toJSON();
export const clearSlashBody = clearSlashData.toJSON();
export const stopSlashBody = stopSlashData.toJSON();
export const helpSlashBody = helpSlashData.toJSON();
export const settingsSlashBody = settingsSlashData.toJSON();
export const setdjSlashBody = setdjSlashData.toJSON();
export const prefixSlashBody = prefixSlashData.toJSON();
export const settcSlashBody = settcSlashData.toJSON();
export const setvcSlashBody = setvcSlashData.toJSON();

const guildSlashBodies = [
  playSlashBody,
  scsearchSlashBody,
  skipSlashBody,
  queueSlashBody,
  pauseSlashBody,
  resumeSlashBody,
  nowplayingSlashBody,
  removeSlashBody,
  shuffleSlashBody,
  clearSlashBody,
  stopSlashBody,
  helpSlashBody,
  settingsSlashBody,
  setdjSlashBody,
  prefixSlashBody,
  settcSlashBody,
  setvcSlashBody,
] as const;

/** Canonical slash names bulk-PUT to each guild. No prefix aliases. */
export const registeredSlashNames: readonly string[] = guildSlashBodies.map(
  (body) => body.name,
);

export interface RegisterGuildCommandsInput {
  readonly applicationId: string;
  readonly guildId: string;
  readonly restPut: (
    guildId: string,
    body: readonly unknown[],
  ) => Promise<void>;
}

/**
 * Bulk-PUTs the guild slash commands. Same-name PUT is idempotent.
 * @param input - Application id, guild id, and injected REST PUT.
 */
export async function registerGuildCommands(
  input: RegisterGuildCommandsInput,
): Promise<void> {
  await input.restPut(input.guildId, guildSlashBodies);
}
