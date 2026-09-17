export interface OperatorEnv {
  readonly commandPrefix: string;
  readonly djRoleId: string | null;
  readonly stayInChannel: boolean;
  readonly aloneTimeUntilStopSeconds: number;
  readonly idleLeaveSeconds: number;
}

export interface GuildOperatorOverlay {
  readonly prefix?: string;
  readonly djRoleId?: string | null;
  readonly textChannelId?: string | null;
  readonly voiceChannelId?: string | null;
}

export interface GuildOperatorView {
  readonly prefix: string;
  readonly djRoleId: string | null;
  readonly textChannelId: string | null;
  readonly voiceChannelId: string | null;
  readonly stayInChannel: boolean;
  readonly aloneTimeUntilStopSeconds: number;
  readonly idleLeaveSeconds: number;
}

export interface DjCommandAccessInput {
  readonly djRoleId: string | null;
  readonly invokerIsAdmin: boolean;
  readonly invokerRoleIds: readonly string[];
}

interface MutableGuildOverlay {
  prefix?: string;
  djRoleId?: string | null;
  textChannelId?: string | null;
  voiceChannelId?: string | null;
}

const overlays: Map<string, MutableGuildOverlay> = new Map();

const DEFAULT_PREFIX = "!";
const DEFAULT_IDLE_LEAVE_SECONDS = 300;

/**
 * Reads operator env keys from a process env object.
 * @param env - Process environment.
 * @returns Parsed operator env with defaults applied.
 */
export function readOperatorEnv(env: NodeJS.ProcessEnv): OperatorEnv {
  return {
    commandPrefix: readCommandPrefix(env),
    djRoleId: readDjRoleId(env),
    stayInChannel: readStayInChannel(env),
    aloneTimeUntilStopSeconds: readAloneTimeUntilStopSeconds(env),
    idleLeaveSeconds: readIdleLeaveSeconds(env),
  };
}

/**
 * Merges the guild overlay over env. Missing overlay fields fall through.
 * @param guildId - Discord guild snowflake.
 * @param env - Process environment used as the base.
 * @returns Guild view used by doors and operator commands.
 */
export function getGuildOperatorView(
  guildId: string,
  env: NodeJS.ProcessEnv,
): GuildOperatorView {
  const base: OperatorEnv = readOperatorEnv(env);
  const overlay: MutableGuildOverlay | undefined = overlays.get(guildId);
  return {
    prefix: mergePrefix(base.commandPrefix, overlay),
    djRoleId: mergeDjRoleId(base.djRoleId, overlay),
    textChannelId: overlay?.textChannelId ?? null,
    voiceChannelId: overlay?.voiceChannelId ?? null,
    stayInChannel: base.stayInChannel,
    aloneTimeUntilStopSeconds: base.aloneTimeUntilStopSeconds,
    idleLeaveSeconds: base.idleLeaveSeconds,
  };
}

/**
 * Stores a non-empty prefix overlay for a guild.
 * @param guildId - Discord guild snowflake.
 * @param prefix - Replacement prefix. Empty string is ignored.
 */
export function setGuildOverlayPrefix(guildId: string, prefix: string): void {
  if (prefix.length === 0) {
    return;
  }
  overlayFor(guildId).prefix = prefix;
}

/**
 * Deletes the prefix overlay so the guild falls back to env prefix.
 * @param guildId - Discord guild snowflake.
 */
export function clearGuildOverlayPrefix(guildId: string): void {
  const overlay: MutableGuildOverlay | undefined = overlays.get(guildId);
  if (overlay === undefined) {
    return;
  }
  delete overlay.prefix;
}

/**
 * Stores a DJ role overlay. `null` overrides an env role for this guild.
 * @param guildId - Discord guild snowflake.
 * @param djRoleId - Role snowflake, or `null` for no DJ role.
 */
export function setGuildOverlayDjRoleId(
  guildId: string,
  djRoleId: string | null,
): void {
  overlayFor(guildId).djRoleId = djRoleId;
}

/**
 * Stores a text-channel overlay. `null` means no bound text channel.
 * @param guildId - Discord guild snowflake.
 * @param textChannelId - Channel snowflake, or `null` to clear.
 */
export function setGuildOverlayTextChannelId(
  guildId: string,
  textChannelId: string | null,
): void {
  overlayFor(guildId).textChannelId = textChannelId;
}

/**
 * Stores a voice-channel overlay. `null` means no bound voice channel.
 * @param guildId - Discord guild snowflake.
 * @param voiceChannelId - Channel snowflake, or `null` to clear.
 */
export function setGuildOverlayVoiceChannelId(
  guildId: string,
  voiceChannelId: string | null,
): void {
  overlayFor(guildId).voiceChannelId = voiceChannelId;
}

/**
 * Drops one guild overlay. Env values apply again for that guild.
 * @param guildId - Discord guild snowflake.
 */
export function clearGuildOverlay(guildId: string): void {
  overlays.delete(guildId);
}

/**
 * Drops every guild overlay. Used by tests so cases do not leak state.
 */
export function clearAllOverlays(): void {
  overlays.clear();
}

/**
 * Checks whether an invoker may run DJ-class commands.
 * @param input - Guild DJ role, admin flag, and invoker role ids.
 * @returns `true` when DJ commands are open, the invoker is admin, or the role matches.
 */
export function canUseDjCommands(input: DjCommandAccessInput): boolean {
  if (input.djRoleId === null) {
    return true;
  }
  if (input.invokerIsAdmin) {
    return true;
  }
  return input.invokerRoleIds.includes(input.djRoleId);
}

function overlayFor(guildId: string): MutableGuildOverlay {
  const existing: MutableGuildOverlay | undefined = overlays.get(guildId);
  if (existing !== undefined) {
    return existing;
  }
  const created: MutableGuildOverlay = {};
  overlays.set(guildId, created);
  return created;
}

function mergePrefix(
  envPrefix: string,
  overlay: MutableGuildOverlay | undefined,
): string {
  const overlayPrefix: string | undefined = overlay?.prefix;
  if (overlayPrefix === undefined || overlayPrefix.length === 0) {
    return envPrefix;
  }
  return overlayPrefix;
}

function mergeDjRoleId(
  envDjRoleId: string | null,
  overlay: MutableGuildOverlay | undefined,
): string | null {
  if (overlay === undefined || !("djRoleId" in overlay)) {
    return envDjRoleId;
  }
  const overlayRole: string | null | undefined = overlay.djRoleId;
  if (overlayRole === undefined) {
    return envDjRoleId;
  }
  return overlayRole;
}

function readCommandPrefix(env: NodeJS.ProcessEnv): string {
  const prefix: string | undefined = env["COMMAND_PREFIX"];
  if (prefix === undefined || prefix.length === 0) {
    return DEFAULT_PREFIX;
  }
  return prefix;
}

function readDjRoleId(env: NodeJS.ProcessEnv): string | null {
  const roleId: string | undefined = env["DJ_ROLE_ID"];
  if (roleId === undefined || roleId.length === 0) {
    return null;
  }
  return roleId;
}

function readStayInChannel(env: NodeJS.ProcessEnv): boolean {
  const raw: string | undefined = env["STAY_IN_CHANNEL"];
  if (raw === undefined) {
    return false;
  }
  const normalized: string = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function readAloneTimeUntilStopSeconds(env: NodeJS.ProcessEnv): number {
  const parsed: number | null = parseInteger(env["ALONE_TIME_UNTIL_STOP"]);
  if (parsed === null || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function readIdleLeaveSeconds(env: NodeJS.ProcessEnv): number {
  const parsed: number | null = parseInteger(env["IDLE_LEAVE_SECONDS"]);
  if (parsed === null || parsed < 0) {
    return DEFAULT_IDLE_LEAVE_SECONDS;
  }
  return parsed;
}

function parseInteger(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  const trimmed: string = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  return Number.parseInt(trimmed, 10);
}
