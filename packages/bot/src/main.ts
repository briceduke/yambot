import { openTrackAudio, resolveTrack } from "@yambot/audio-engine";
import {
  Client,
  Events,
  GatewayIntentBits,
  GuildMember,
  PermissionFlagsBits,
  Routes,
  type ChatInputCommandInteraction,
  type Client as DiscordClient,
  type CloseEvent,
  type Guild,
  type Interaction,
  type Message,
  type VoiceState,
} from "discord.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CommandContext } from "./command-context.ts";
import { executeClear } from "./commands/clear.ts";
import { executeHelp } from "./commands/help.ts";
import { executeNowPlaying } from "./commands/nowplaying.ts";
import { executePause } from "./commands/pause.ts";
import { executePlay } from "./commands/play.ts";
import { executePrefix } from "./commands/prefix.ts";
import { executeQueue } from "./commands/queue.ts";
import { executeRemove } from "./commands/remove.ts";
import { executeResume } from "./commands/resume.ts";
import { executeScsearch } from "./commands/scsearch.ts";
import { executeSetDj } from "./commands/setdj.ts";
import { executeSetTc } from "./commands/settc.ts";
import { executeSetVc } from "./commands/setvc.ts";
import { executeSettings } from "./commands/settings.ts";
import { executeShuffle } from "./commands/shuffle.ts";
import { executeSkip } from "./commands/skip.ts";
import { executeStop } from "./commands/stop.ts";
import { createDiscordVoicePort } from "./discord-voice.ts";
import { applyDoorGates } from "./door-gates.ts";
import {
  createSession,
  getSession,
  type EnginePort,
  type GuildMusicSession,
  type LeavePolicy,
} from "./guild-music-session.ts";
import {
  getGuildOperatorView,
  readOperatorEnv,
} from "./operator-config.ts";
import {
  parsePrefixMessage,
  type ParsedPrefixCommand,
  type PrefixParseInput,
} from "./prefix.ts";
import { registerGuildCommands } from "./register-commands.ts";
import {
  exitIfDisallowedIntents,
  requireDiscordToken,
} from "./startup.ts";

const engine: EnginePort = {
  resolveTrack,
  openTrackAudio,
};

const prefixAliases: Readonly<Record<string, string>> = {
  np: "nowplaying",
  leave: "stop",
  setprefix: "prefix",
  status: "settings",
};

const knownCommandNames = new Set([
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
  "help",
  "settings",
  "setdj",
  "prefix",
  "settc",
  "setvc",
]);

interface SessionCommand {
  (ctx: CommandContext, session: GuildMusicSession | undefined): Promise<void>;
}

interface OperatorCommand {
  (ctx: CommandContext): Promise<void>;
}

const sessionCommands: Readonly<Record<string, SessionCommand>> = {
  skip: executeSkip,
  queue: executeQueue,
  pause: executePause,
  resume: executeResume,
  nowplaying: executeNowPlaying,
  remove: executeRemove,
  shuffle: executeShuffle,
  clear: executeClear,
  stop: executeStop,
};

const operatorCommands: Readonly<Record<string, OperatorCommand>> = {
  help: executeHelp,
  settings: executeSettings,
  setdj: executeSetDj,
  prefix: executePrefix,
  settc: executeSetTc,
  setvc: executeSetVc,
};

const suppressedMentions = { parse: [] as const };

/**
 * Runs one command module. Both doors call this with the same name and context.
 * @param name - Canonical command name. Prefix aliases are resolved before this.
 * @param ctx - Transport-agnostic command context.
 * @param session - Guild session; `play` and `scsearch` require one, other commands may omit it.
 */
export async function dispatchCommand(
  name: string,
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  const operator: OperatorCommand | undefined = operatorCommands[name];
  if (operator !== undefined) {
    await operator(ctx);
    return;
  }
  if (name === "play" || name === "scsearch") {
    if (session === undefined) {
      return;
    }
    if (name === "play") {
      await executePlay(ctx, session);
      return;
    }
    await executeScsearch(ctx, session);
    return;
  }
  const run: SessionCommand | undefined = sessionCommands[name];
  if (run === undefined) {
    return;
  }
  await run(ctx, session);
}

/**
 * Parses a prefix message and drops bots, DMs, non-commands, and unknown names.
 * Maps prefix-only aliases (`np`, `leave`, `setprefix`, `status`) to canonical names.
 * @param input - Prefix parse fields from a message-like object.
 * @returns Known command name and args, or `null` when the door should ignore.
 */
export function readPrefixDoorCommand(
  input: PrefixParseInput,
): ParsedPrefixCommand | null {
  const parsed: ParsedPrefixCommand | null = parsePrefixMessage(input);
  if (parsed === null) {
    return null;
  }
  const name: string = prefixAliases[parsed.name] ?? parsed.name;
  if (!knownCommandNames.has(name)) {
    return null;
  }
  return { name, args: parsed.args };
}

function startBot(): void {
  const token: string = requireDiscordToken(
    process.env,
    console.error,
    process.exit,
  );
  if (token.length === 0) {
    return;
  }
  const client: DiscordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  bindClientEvents(client);
  void client.login(token);
}

function bindClientEvents(client: DiscordClient): void {
  client.on(Events.ShardDisconnect, (closeEvent: CloseEvent) => {
    exitIfDisallowedIntents(closeEvent.code, console.error, process.exit);
  });
  client.on(Events.ClientReady, (readyClient: DiscordClient<true>) => {
    void registerReadyGuilds(readyClient);
  });
  client.on(Events.GuildCreate, (guild: Guild) => {
    void registerCreatedGuild(guild);
  });
  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void handleInteraction(interaction);
  });
  client.on(Events.MessageCreate, (message: Message) => {
    void handlePrefixMessage(message);
  });
  client.on(
    Events.VoiceStateUpdate,
    (_oldState: VoiceState, newState: VoiceState) => {
      handleVoiceStateUpdate(newState.guild);
    },
  );
}

async function registerReadyGuilds(
  readyClient: DiscordClient<true>,
): Promise<void> {
  const applicationId: string = readyClient.application.id;
  for (const guild of readyClient.guilds.cache.values()) {
    await registerGuildCommands({
      applicationId,
      guildId: guild.id,
      restPut: (guildId, body) =>
        putGuildSlashCommands(readyClient, applicationId, guildId, body),
    });
  }
}

async function registerCreatedGuild(guild: Guild): Promise<void> {
  const applicationId: string | undefined = guild.client.application?.id;
  if (applicationId === undefined) {
    return;
  }
  await registerGuildCommands({
    applicationId,
    guildId: guild.id,
    restPut: (guildId, body) =>
      putGuildSlashCommands(guild.client, applicationId, guildId, body),
  });
}

async function putGuildSlashCommands(
  client: DiscordClient,
  applicationId: string,
  guildId: string,
  body: readonly unknown[],
): Promise<void> {
  await client.rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
    body: [...body],
  });
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }
  await interaction.deferReply();
  const guild: Guild | null = interaction.guild;
  if (guild === null || interaction.channelId === null) {
    return;
  }
  const member: GuildMember | null =
    interaction.member instanceof GuildMember ? interaction.member : null;
  await runDoorCommand(
    interaction.commandName,
    createSlashContext(interaction, guild),
    guild,
    interaction.channel,
    member,
  );
}

async function handlePrefixMessage(message: Message): Promise<void> {
  const guild: Guild | null = message.guild;
  if (guild === null) {
    return;
  }
  const parsed: ParsedPrefixCommand | null = readPrefixDoorCommand({
    content: message.content,
    prefix: getGuildOperatorView(guild.id, process.env).prefix,
    isBot: message.author.bot,
    inGuild: true,
    botUserId: message.client.user?.id,
  });
  if (parsed === null) {
    return;
  }
  await runDoorCommand(
    parsed.name,
    createPrefixContext(message, guild, parsed.args),
    guild,
    message.channel,
    message.member,
  );
}

async function runDoorCommand(
  name: string,
  ctx: CommandContext,
  guild: Guild,
  announceChannel: ChatInputCommandInteraction["channel"] | Message["channel"],
  member: GuildMember | null,
): Promise<void> {
  const denyReply: string | null = applyDoorGates({
    name,
    guildId: guild.id,
    channelId: ctx.channelId,
    invokerVoiceChannelId: ctx.invokerVoiceChannelId,
    invokerIsAdmin: memberHasManageGuild(member),
    invokerRoleIds: memberRoleIds(member),
    env: process.env,
    boundVoiceChannelName: readBoundVoiceChannelName(guild),
  });
  if (denyReply !== null) {
    await ctx.reply(denyReply);
    return;
  }
  if (name === "play" || name === "scsearch") {
    const session: GuildMusicSession = getOrCreateGuildSession(guild);
    bindAnnounceFromChannel(session, announceChannel);
    await dispatchCommand(name, ctx, session);
    return;
  }
  await dispatchCommand(name, ctx, getSession(guild.id));
}

function getOrCreateGuildSession(guild: Guild): GuildMusicSession {
  const existing: GuildMusicSession | undefined = getSession(guild.id);
  if (existing !== undefined) {
    return existing;
  }
  return createSession({
    guildId: guild.id,
    engine,
    voice: createDiscordVoicePort(guild),
    leavePolicy: leavePolicyFromEnv(process.env),
  });
}

function leavePolicyFromEnv(env: NodeJS.ProcessEnv): LeavePolicy {
  const parsed = readOperatorEnv(env);
  return {
    idleLeaveMs: parsed.idleLeaveSeconds * 1000,
    stayInChannel: parsed.stayInChannel,
    aloneTimeUntilStopMs: parsed.aloneTimeUntilStopSeconds * 1000,
  };
}

function createSlashContext(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
): CommandContext {
  return {
    guildId: guild.id,
    channelId: interaction.channelId ?? "",
    invokerVoiceChannelId: readInvokerVoiceChannelId(
      interaction.member instanceof GuildMember ? interaction.member : null,
      guild,
      interaction.user.id,
    ),
    args: readSlashArgs(interaction),
    reply: async (text: string): Promise<void> => {
      await interaction.editReply({
        content: text,
        allowedMentions: suppressedMentions,
      });
    },
  };
}

function readSlashArgs(interaction: ChatInputCommandInteraction): string {
  if (interaction.commandName === "play" || interaction.commandName === "scsearch") {
    return interaction.options.getString("query") ?? "";
  }
  if (interaction.commandName === "remove") {
    const position: number | null = interaction.options.getInteger("position");
    if (position === null) {
      return "";
    }
    return String(position);
  }
  if (interaction.commandName === "prefix") {
    return interaction.options.getString("value") ?? "";
  }
  if (interaction.commandName === "setdj") {
    return interaction.options.getRole("role")?.id ?? "";
  }
  if (interaction.commandName === "settc" || interaction.commandName === "setvc") {
    return interaction.options.getChannel("channel")?.id ?? "";
  }
  return "";
}

function createPrefixContext(
  message: Message,
  guild: Guild,
  args: string,
): CommandContext {
  return {
    guildId: guild.id,
    channelId: message.channelId,
    invokerVoiceChannelId: readInvokerVoiceChannelId(
      message.member,
      guild,
      message.author.id,
    ),
    args,
    reply: async (text: string): Promise<void> => {
      await sendPublic(message.channel, text);
    },
  };
}

function readInvokerVoiceChannelId(
  member: GuildMember | null,
  guild: Guild,
  userId: string,
): string | null {
  if (member instanceof GuildMember) {
    return member.voice.channelId;
  }
  return guild.voiceStates.cache.get(userId)?.channelId ?? null;
}

function memberHasManageGuild(member: GuildMember | null): boolean {
  if (member === null) {
    return false;
  }
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function memberRoleIds(member: GuildMember | null): readonly string[] {
  if (member === null) {
    return [];
  }
  return [...member.roles.cache.keys()];
}

function readBoundVoiceChannelName(guild: Guild): string | null {
  const voiceChannelId: string | null = getGuildOperatorView(
    guild.id,
    process.env,
  ).voiceChannelId;
  if (voiceChannelId === null) {
    return null;
  }
  const channel = guild.channels.cache.get(voiceChannelId);
  if (channel === undefined) {
    return null;
  }
  return channel.name;
}

function handleVoiceStateUpdate(guild: Guild): void {
  const session: GuildMusicSession | undefined = getSession(guild.id);
  if (session === undefined) {
    return;
  }
  const channelId: string | null = session.voiceChannelId;
  if (channelId === null) {
    return;
  }
  session.noteHumanListenerCount(countHumansInVoice(guild, channelId));
}

function countHumansInVoice(guild: Guild, channelId: string): number {
  let count = 0;
  for (const state of guild.voiceStates.cache.values()) {
    if (state.channelId !== channelId) {
      continue;
    }
    if (state.member === null || state.member.user.bot) {
      continue;
    }
    count += 1;
  }
  return count;
}

function bindAnnounceFromChannel(
  session: GuildMusicSession,
  channel: ChatInputCommandInteraction["channel"] | Message["channel"],
): void {
  session.bindAnnounce(async (text: string): Promise<void> => {
    await sendPublic(channel, text);
  });
}

async function sendPublic(
  channel: ChatInputCommandInteraction["channel"] | Message["channel"],
  text: string,
): Promise<void> {
  if (channel === null || !channel.isSendable()) {
    return;
  }
  await channel.send({
    content: text,
    allowedMentions: suppressedMentions,
  });
}

function isExecutedAsMain(): boolean {
  const entryPath: string | undefined = process.argv[1];
  if (entryPath === undefined) {
    return false;
  }
  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entryPath);
}

if (isExecutedAsMain()) {
  startBot();
}
