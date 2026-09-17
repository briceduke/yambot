import {
  canUseDjCommands,
  getGuildOperatorView,
  type GuildOperatorView,
} from "./operator-config.ts";

const ADMIN_COMMAND_NAMES: ReadonlySet<string> = new Set([
  "prefix",
  "setdj",
  "settc",
  "setvc",
]);

const DJ_COMMAND_NAMES: ReadonlySet<string> = new Set([
  "pause",
  "resume",
  "remove",
  "shuffle",
  "clear",
  "stop",
  "skip",
]);

const TEXT_CHANNEL_GATED_NAMES: ReadonlySet<string> = new Set([
  "play",
  "scsearch",
  "skip",
  "queue",
  "pause",
  "resume",
  "nowplaying",
  "remove",
  "shuffle",
  "clear",
  "stop",
]);

const VOICE_CHANNEL_GATED_NAMES: ReadonlySet<string> = new Set([
  "play",
  "scsearch",
]);

export const ADMIN_DENY_REPLY = "You need Manage Server to use that.";
export const DJ_DENY_REPLY = "You need the DJ role to use that.";
export const BOUND_VOICE_FALLBACK_REPLY =
  "Join the bound voice channel to play.";

export interface DoorGateInput {
  readonly name: string;
  readonly guildId: string;
  readonly channelId: string;
  readonly invokerVoiceChannelId: string | null;
  readonly invokerIsAdmin: boolean;
  readonly invokerRoleIds: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly boundVoiceChannelName: string | null;
}

/**
 * Runs admin, DJ, text-channel, and voice-channel gates in that order.
 * @param input - Command name, invoker flags, and guild view inputs.
 * @returns Deny reply text, or `null` when the door should dispatch.
 */
export function applyDoorGates(input: DoorGateInput): string | null {
  const view: GuildOperatorView = getGuildOperatorView(input.guildId, input.env);
  const adminDeny: string | null = adminDenyReply(input.name, input.invokerIsAdmin);
  if (adminDeny !== null) {
    return adminDeny;
  }
  const djDeny: string | null = djDenyReply(input, view);
  if (djDeny !== null) {
    return djDeny;
  }
  const textDeny: string | null = textChannelDenyReply(input, view);
  if (textDeny !== null) {
    return textDeny;
  }
  return voiceChannelDenyReply(input, view);
}

/**
 * Builds the settc wrong-channel reply.
 * @param channelId - Bound text channel snowflake.
 * @returns Reply string.
 */
export function boundTextChannelReply(channelId: string): string {
  return `Use music commands in <#${channelId}>.`;
}

/**
 * Builds the setvc wrong-channel reply.
 * @param channelName - Bound voice channel name, or `null` when unknown.
 * @returns Reply string.
 */
export function boundVoiceChannelReply(channelName: string | null): string {
  if (channelName === null || channelName.length === 0) {
    return BOUND_VOICE_FALLBACK_REPLY;
  }
  return `Join #${channelName} to play.`;
}

function adminDenyReply(name: string, invokerIsAdmin: boolean): string | null {
  if (!ADMIN_COMMAND_NAMES.has(name) || invokerIsAdmin) {
    return null;
  }
  return ADMIN_DENY_REPLY;
}

function djDenyReply(
  input: DoorGateInput,
  view: GuildOperatorView,
): string | null {
  if (!DJ_COMMAND_NAMES.has(input.name)) {
    return null;
  }
  const allowed: boolean = canUseDjCommands({
    djRoleId: view.djRoleId,
    invokerIsAdmin: input.invokerIsAdmin,
    invokerRoleIds: input.invokerRoleIds,
  });
  if (allowed) {
    return null;
  }
  return DJ_DENY_REPLY;
}

function textChannelDenyReply(
  input: DoorGateInput,
  view: GuildOperatorView,
): string | null {
  if (!TEXT_CHANNEL_GATED_NAMES.has(input.name)) {
    return null;
  }
  if (view.textChannelId === null || view.textChannelId === input.channelId) {
    return null;
  }
  return boundTextChannelReply(view.textChannelId);
}

function voiceChannelDenyReply(
  input: DoorGateInput,
  view: GuildOperatorView,
): string | null {
  if (!VOICE_CHANNEL_GATED_NAMES.has(input.name)) {
    return null;
  }
  if (view.voiceChannelId === null) {
    return null;
  }
  if (input.invokerVoiceChannelId === view.voiceChannelId) {
    return null;
  }
  return boundVoiceChannelReply(input.boundVoiceChannelName);
}
