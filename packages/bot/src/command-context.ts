import type { APIEmbed } from "discord.js";

/** Optional payload for a command reply. Text-only callers omit this. */
export interface CommandReplyOptions {
  readonly embeds?: readonly APIEmbed[];
}

/** Transport-agnostic command input. */
export interface CommandContext {
  readonly guildId: string;
  readonly channelId: string;
  readonly invokerVoiceChannelId: string | null;
  /** Raw argument text: slash option value or prefix remainder. Empty when none. */
  readonly args: string;
  /** Edits the deferred reply under slash; sends a channel message under prefix. Mentions suppressed. */
  reply(text: string, options?: CommandReplyOptions): Promise<void>;
}
