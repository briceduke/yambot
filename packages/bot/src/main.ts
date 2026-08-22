import { openTrackAudio, resolveTrack } from "@yambot/audio-engine";
import {
  Client,
  Events,
  GatewayIntentBits,
  GuildMember,
  Routes,
  type ChatInputCommandInteraction,
  type Client as DiscordClient,
  type CloseEvent,
  type Guild,
  type Interaction,
  type Message,
} from "discord.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CommandContext } from "./command-context.ts";
import { executeClear } from "./commands/clear.ts";
import { executeNowPlaying } from "./commands/nowplaying.ts";
import { executePause } from "./commands/pause.ts";
import { executePlay } from "./commands/play.ts";
import { executeQueue } from "./commands/queue.ts";
import { executeScsearch } from "./commands/scsearch.ts";
import { executeRemove } from "./commands/remove.ts";
import { executeResume } from "./commands/resume.ts";
import { executeShuffle } from "./commands/shuffle.ts";
import { executeSkip } from "./commands/skip.ts";
import { executeStop } from "./commands/stop.ts";
import { createDiscordVoicePort } from "./discord-voice.ts";
import {
  createSession,
  getSession,
  type EnginePort,
  type GuildMusicSession,
} from "./guild-music-session.ts";
import {
  parsePrefixMessage,
  readCommandPrefix,
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
]);

interface SessionCommand {
  (ctx: CommandContext, session: GuildMusicSession | undefined): Promise<void>;
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
 * Maps prefix-only aliases (`np`, `leave`) to canonical names.
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
  await runDoorCommand(
    interaction.commandName,
    createSlashContext(interaction, guild),
    guild,
    interaction.channel,
  );
}

async function handlePrefixMessage(message: Message): Promise<void> {
  const parsed: ParsedPrefixCommand | null = readPrefixDoorCommand({
    content: message.content,
    prefix: readCommandPrefix(process.env),
    isBot: message.author.bot,
    inGuild: message.guild !== null,
  });
  if (parsed === null || message.guild === null) {
    return;
  }
  await runDoorCommand(
    parsed.name,
    createPrefixContext(message, message.guild, parsed.args),
    message.guild,
    message.channel,
  );
}

async function runDoorCommand(
  name: string,
  ctx: CommandContext,
  guild: Guild,
  announceChannel: ChatInputCommandInteraction["channel"] | Message["channel"],
): Promise<void> {
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
  });
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
