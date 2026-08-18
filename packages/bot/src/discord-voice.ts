import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
  type AudioPlayer,
  type DiscordGatewayAdapterCreator,
  type VoiceConnection,
  type VoiceConnectionState,
} from "@discordjs/voice";
import type { AudioFormat, TrackAudio } from "@yambot/audio-engine";
import type { Guild } from "discord.js";
import { Readable } from "node:stream";

import type { VoicePort } from "./guild-music-session.ts";

const JOIN_READY_TIMEOUT_MS = 20_000;

const playbackInputByFormat: { readonly [K in AudioFormat]: StreamType } = {
  "webm/opus": StreamType.WebmOpus,
};

/**
 * Builds a Discord-backed voice port for one guild.
 * @param guild - Guild whose voice adapter and channel cache to use.
 * @returns Voice port used by `GuildMusicSession`.
 */
export function createDiscordVoicePort(guild: Guild): VoicePort {
  return new DiscordVoicePort(guild);
}

class DiscordVoicePort implements VoicePort {
  readonly #guild: Guild;
  readonly #player: AudioPlayer = createAudioPlayer();
  #connection: VoiceConnection | undefined;
  #channelId: string | null = null;
  #idleHandler: (() => void) | undefined;
  #disconnectedHandler: (() => void) | undefined;

  constructor(guild: Guild) {
    this.#guild = guild;
    this.#player.on("stateChange", (oldState, newState) => {
      if (
        oldState.status !== AudioPlayerStatus.Idle &&
        newState.status === AudioPlayerStatus.Idle
      ) {
        this.#idleHandler?.();
      }
    });
  }

  /**
   * Joins (or moves to) a voice channel and waits until the connection is ready.
   * @param channelId - Voice channel id.
   */
  async join(channelId: string): Promise<void> {
    try {
      await this.#joinReadyAsync(channelId);
    } catch (error) {
      this.#connection?.destroy();
      this.#connection = undefined;
      this.#channelId = null;
      throw new Error(joinFailureMessage(error));
    }
  }

  /**
   * @returns Current voice channel id, or `null` when not connected.
   */
  getChannelId(): string | null {
    return this.#channelId;
  }

  /**
   * @returns Current voice channel name, or `""` when unknown.
   */
  getChannelName(): string {
    if (this.#channelId === null) {
      return "";
    }
    return this.#guild.channels.cache.get(this.#channelId)?.name ?? "";
  }

  /**
   * Plays engine audio as WebM/Opus. No ffmpeg and no inline volume.
   * @param audio - Stream and format from the engine.
   */
  async play(audio: TrackAudio): Promise<void> {
    const inputType: StreamType = playbackInputByFormat[audio.format];
    const resource = createAudioResource(Readable.fromWeb(audio.stream), {
      inputType,
    });
    this.#player.play(resource);
  }

  stop(): void {
    this.#player.stop();
  }

  onIdle(handler: () => void): void {
    this.#idleHandler = handler;
  }

  onDisconnected(handler: () => void): void {
    this.#disconnectedHandler = handler;
  }

  async #joinReadyAsync(channelId: string): Promise<void> {
    const connection: VoiceConnection = joinVoiceChannel({
      channelId,
      guildId: this.#guild.id,
      adapterCreator: this.#guild
        .voiceAdapterCreator as DiscordGatewayAdapterCreator,
    });
    this.#bindConnection(connection);
    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      JOIN_READY_TIMEOUT_MS,
    );
    this.#channelId = channelId;
  }

  #bindConnection(connection: VoiceConnection): void {
    if (this.#connection === connection) {
      connection.subscribe(this.#player);
      return;
    }
    this.#connection = connection;
    connection.subscribe(this.#player);
    connection.on(
      "stateChange",
      (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
        this.#onConnectionStateChange(oldState, newState);
      },
    );
  }

  #onConnectionStateChange(
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState,
  ): void {
    if (!isConnectionGone(newState.status) || isConnectionGone(oldState.status)) {
      return;
    }
    this.#channelId = null;
    this.#disconnectedHandler?.();
  }
}

function isConnectionGone(status: VoiceConnectionStatus): boolean {
  return (
    status === VoiceConnectionStatus.Disconnected ||
    status === VoiceConnectionStatus.Destroyed
  );
}

function joinFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Couldn't join the voice channel.";
}
