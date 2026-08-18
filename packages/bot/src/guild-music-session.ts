import {
  TrackQueue,
  TrackResolveError,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";

import { formatDuration } from "./format-duration.ts";

/** Engine resolve and open functions. Matches `@yambot/audio-engine` signatures. */
export interface EnginePort {
  resolveTrack(input: { readonly query: string }): Promise<Track>;
  openTrackAudio(input: { readonly track: Track }): Promise<TrackAudio>;
}

/** Bot-owned voice connection and player. */
export interface VoicePort {
  join(channelId: string): Promise<void>;
  getChannelId(): string | null;
  getChannelName(): string;
  play(audio: TrackAudio): Promise<void>;
  stop(): void;
  onIdle(handler: () => void): void;
  onDisconnected(handler: () => void): void;
}

export interface CreateSessionInput {
  readonly guildId: string;
  readonly engine: EnginePort;
  readonly voice: VoicePort;
}

export interface SessionSnapshot {
  readonly current: Track | null;
  readonly upcoming: readonly Track[];
}

const sessions: Map<string, GuildMusicSession> = new Map();

/**
 * Returns the in-memory session for a guild, if one exists.
 * @param guildId - Discord guild id.
 * @returns The session, or `undefined`.
 */
export function getSession(guildId: string): GuildMusicSession | undefined {
  return sessions.get(guildId);
}

/**
 * Creates and registers one guild music session.
 * @param input - Guild id, engine port, and voice port.
 * @returns The new session.
 */
export function createSession(input: CreateSessionInput): GuildMusicSession {
  const session: GuildMusicSession = new GuildMusicSession(input);
  sessions.set(input.guildId, session);
  return session;
}

/**
 * Per-guild playback session: engine queue, current track, voice, announce.
 */
export class GuildMusicSession {
  readonly engine: EnginePort;
  readonly #voice: VoicePort;
  readonly #queue: TrackQueue = new TrackQueue();
  #currentTrack: Track | null = null;
  #announce: ((text: string) => Promise<void>) | undefined;
  #ignoreIdle = false;

  constructor(input: CreateSessionInput) {
    this.engine = input.engine;
    this.#voice = input.voice;
    this.#voice.onIdle(() => {
      void this.#advanceOnIdleAsync();
    });
    this.#voice.onDisconnected(() => {
      this.#onVoiceDisconnected();
    });
  }

  /**
   * Current track, or `null` when idle.
   * @returns The track now playing.
   */
  get currentTrack(): Track | null {
    return this.#currentTrack;
  }

  /**
   * Binds the announce sender used by the advance loop. Play door rebinds this.
   * @param send - Sends a channel message.
   */
  bindAnnounce(send: (text: string) => Promise<void>): void {
    this.#announce = send;
  }

  /**
   * Opens audio and plays immediately. First-track open failure throws and
   * does not set current or enqueue.
   * @param track - Track to play now.
   */
  async playNow(track: Track): Promise<void> {
    const audio: TrackAudio = await openOrWrapAsync(this.engine, track);
    this.#ignoreIdle = false;
    await this.#voice.play(audio);
    this.#currentTrack = track;
  }

  /**
   * Enqueues a track and returns its display position (current occupies #1).
   * @param track - Track to queue.
   * @returns 1-based display position including the current track.
   */
  enqueue(track: Track): number {
    this.#queue.enqueue(track);
    return this.#queue.size + 1;
  }

  /**
   * Stops the player. Returns the skipped track, or `null` if nothing is current.
   * @returns The skipped track, or `null`.
   */
  skipCurrent(): Track | null {
    const skipped: Track | null = this.#currentTrack;
    if (skipped === null) {
      return null;
    }
    this.#voice.stop();
    return skipped;
  }

  /**
   * Current track plus upcoming queue copy.
   * @returns Snapshot of playback state.
   */
  snapshot(): SessionSnapshot {
    return {
      current: this.#currentTrack,
      upcoming: this.#queue.list(),
    };
  }

  /**
   * True when this guild is playing in a different voice channel than the invoker.
   * @param invokerVoiceChannelId - Invoker's voice channel id.
   * @returns Whether the session is occupied elsewhere.
   */
  isOccupiedInOtherChannel(invokerVoiceChannelId: string): boolean {
    if (this.#currentTrack === null) {
      return false;
    }
    const channelId: string | null = this.#voice.getChannelId();
    if (channelId === null) {
      return false;
    }
    return channelId !== invokerVoiceChannelId;
  }

  /**
   * Voice channel name used in occupied-channel replies.
   * @returns Channel name, or empty when unknown.
   */
  get voiceChannelName(): string {
    return this.#voice.getChannelName();
  }

  /**
   * Joins the invoker's channel, or moves only when idle.
   * @param channelId - Invoker's voice channel id.
   */
  async joinInvoker(channelId: string): Promise<void> {
    if (this.#shouldStayInCurrentChannel(channelId)) {
      return;
    }
    await this.#voice.join(channelId);
  }

  #shouldStayInCurrentChannel(channelId: string): boolean {
    if (this.#currentTrack === null) {
      return false;
    }
    const currentId: string | null = this.#voice.getChannelId();
    return currentId !== null && currentId !== channelId;
  }

  #onVoiceDisconnected(): void {
    this.#ignoreIdle = true;
    this.#voice.stop();
    this.#currentTrack = null;
  }

  async #advanceOnIdleAsync(): Promise<void> {
    if (this.#ignoreIdle) {
      return;
    }
    await this.#playNextFromQueueAsync();
  }

  async #playNextFromQueueAsync(): Promise<void> {
    const next: Track | null = this.#queue.dequeueNext();
    if (next === null) {
      this.#currentTrack = null;
      return;
    }
    const played: boolean = await this.#tryPlayNextAsync(next);
    if (!played) {
      await this.#playNextFromQueueAsync();
    }
  }

  async #tryPlayNextAsync(track: Track): Promise<boolean> {
    try {
      const audio: TrackAudio = await openOrWrapAsync(this.engine, track);
      await this.#voice.play(audio);
      this.#currentTrack = track;
      await this.#sendAnnounceAsync(nowPlayingText(track));
      return true;
    } catch {
      await this.#sendAnnounceAsync(`Skipping ${track.title}: couldn't play it`);
      return false;
    }
  }

  async #sendAnnounceAsync(text: string): Promise<void> {
    if (this.#announce === undefined) {
      return;
    }
    await this.#announce(text);
  }
}

async function openOrWrapAsync(
  engine: EnginePort,
  track: Track,
): Promise<TrackAudio> {
  try {
    return await engine.openTrackAudio({ track });
  } catch (error) {
    if (error instanceof TrackResolveError) {
      throw error;
    }
    throw new TrackResolveError(openFailureMessage(error));
  }
}

function openFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Couldn't play that track.";
}

function nowPlayingText(track: Track): string {
  return `Now playing: ${track.title} (${formatDuration(track.durationSeconds)})`;
}
